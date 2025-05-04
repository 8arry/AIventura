from fastapi import APIRouter, Depends, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from pydantic import BaseModel
from app.db import get_session
from app.models.chat import ChatMessage
from app.crud.chat import get_or_create_chat_session
from datetime import datetime, timezone, timedelta
from app.api.trips_cache import save_trip_to_cache
from app.crud.trip import create_trip
from app.agents.trip_planner_autogen import (
    create_trip_plan,
    user_proxy,
    planner,
    maps_agent,
    weather_agent,
    search_agent,
    report_agent,
    llm_config,
    extract_final_json
)
import autogen
import json
import asyncio
router = APIRouter()

class ChatMessageCreate(BaseModel):
    session_id: UUID
    role: str
    content: str

class ChatMessageRead(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

def extract_final_json(messages):
    """Extract the final JSON result from the messages"""
    try:
        # Find the last message from the report_agent
        report_messages = [msg for msg in messages if msg.get("name") == "report_agent"]
        if not report_messages:
            print("No report messages found")
            return {"days": []}
            
        last_report = report_messages[-1]
        content = last_report.get("content", "")
        
        # Try to find JSON in the content
        start_idx = content.find("{")
        end_idx = content.rfind("}")
        
        if start_idx == -1 or end_idx == -1:
            print("No JSON found in content")
            return {"days": []}
            
        json_str = content[start_idx:end_idx + 1]
        try:
            result = json.loads(json_str)
            if not isinstance(result, dict):
                print("Result is not a dictionary")
                return {"days": []}
            return result
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            return {"days": []}
            
    except Exception as e:
        print(f"Error in extract_final_json: {e}")
        return {"days": []}

async def stream_agent_thoughts(user_input: str, start_date: datetime, session_id: UUID, db: AsyncSession):
    """Stream agent thoughts during trip planning"""
    try:
        # Initialize chat group
        groupchat = autogen.GroupChat(
            agents=[user_proxy, planner, maps_agent, weather_agent, search_agent, report_agent],
            messages=[],
            max_round=50
        )
        manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)

        # Create a queue to store messages
        message_queue = asyncio.Queue()

        # Override the send function to capture messages
        original_send = manager.send

        async def custom_send(message, recipient, request_reply, silent=False):
            try:
                # Send the message
                await original_send(message, recipient, request_reply, silent)
                # Add to queue for streaming
                if message.get("role") != "user":
                    await message_queue.put(message)
            except Exception as e:
                print(f"Error in custom_send: {str(e)}")
                raise e

        manager.send = custom_send

        # Start conversation in background
        chat_task = asyncio.create_task(user_proxy.initiate_chat(
            manager,
            message=f"""Please help me plan a trip:
            User input: {user_input}
            Start date: {start_date.strftime('%Y-%m-%d') if start_date else 'Not specified'}
            
            Please follow these steps:
            1. Analyze user requirements and extract key information
            2. Search for relevant attractions and activities
            3. Get weather forecast
            4. Optimize daily itinerary
            5. Generate travel report
            
            Final output should include:
            - Complete daily itinerary
            - Weather advice
            - Transportation advice
            - Clothing advice
            - Attraction ratings and reviews
            
            IMPORTANT: The final report must be in valid JSON format.
            """
        ))

        # Stream thoughts in real-time
        chat_completed = False
        while not chat_completed:
            try:
                # Wait for new message with timeout
                msg = await asyncio.wait_for(message_queue.get(), timeout=30.0)
                if msg:
                    try:
                        agent_name = msg.get("name", "Assistant")
                        content = msg.get("content", "")
                        if content:
                            thought = f"{agent_name}: {content}"
                            yield f"data: {json.dumps({'thought': thought})}\n\n"
                            await asyncio.sleep(0.1)  # Small delay for better UX
                    except Exception as e:
                        print(f"Error processing message: {str(e)}")
                        continue
            except asyncio.TimeoutError:
                # Check if chat is completed
                if chat_task.done():
                    chat_completed = True
                else:
                    continue

        # Get final result
        try:
            plan_dict = extract_final_json(groupchat.messages)
            
            # Save to DB and cache
            end_date = start_date + timedelta(days=len(plan_dict.get("days", [])))
            await create_trip(
                db=db,
                session_id=session_id,
                start_date=start_date,
                end_date=end_date,
                trip_name=plan_dict.get("trip_name", "AI Trip"),
                trip_data=plan_dict
            )
            await save_trip_to_cache(session_id, plan_dict)
            
            # Send final result
            yield f"data: {json.dumps({'trip': plan_dict})}\n\n"
        except Exception as e:
            print(f"Error processing final result: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
    except Exception as e:
        print(f"Error in stream_agent_thoughts: {str(e)}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@router.post("/messages")
async def post_message(data: ChatMessageCreate, db: AsyncSession = Depends(get_session)):
    session = await get_or_create_chat_session(data.session_id, db)

    # Save user message
    new_message = ChatMessage(
        session_id=session.id,
        role=data.role,
        content=data.content,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_message)
    await db.commit()

    # Return streaming response
    return StreamingResponse(
        stream_agent_thoughts(data.content, datetime.now(), data.session_id, db),
        media_type="text/event-stream"
    )

@router.get("/messages/{session_id}", response_model=List[ChatMessageRead])
async def get_messages(session_id: UUID, db: AsyncSession = Depends(get_session)):
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
    )
    messages = result.scalars().all()
    return jsonable_encoder(messages)
