"""
Multi-agent Travel Planning System using Autogen
"""

import json
from datetime import datetime, timedelta
from typing import Dict, Optional
from pathlib import Path
import autogen

from app.config import settings
from app.agents.maps_agent import get_place_coordinates, optimize_route
from app.agents.weather_agent import get_weather_with_advice
from app.agents.web_search_agent import search_places, search_with_context


config_list = [
    {
        "model": "gpt-4o",  # or your model name
        "api_key": settings.AZURE_OPENAI_API_KEY,
        "base_url": settings.AZURE_OPENAI_ENDPOINT,
        "api_type": "azure",
        "api_version": "2024-12-01-preview",  # or your version
    }
]

llm_config = {
    "config_list": config_list,
    "temperature": 0,
    "timeout": 600,
}

planner = autogen.AssistantAgent(
    name="planner",
    llm_config=llm_config,
    system_message="""You are a professional travel planner. Your responsibilities are:
    1. Analyze user requirements and extract key information
    2. Coordinate with other agents to complete travel planning
    3. Integrate all information to generate a complete travel plan
    4. Ensure the plan meets user preferences and constraints
    
    You can use the following tools:
    - maps_agent: Get location information and optimize routes
    - weather_agent: Get weather information and advice
    - search_agent: Search for travel-related information

    When the travel plan is complete and confirmed by the user, send the "PLAN_COMPLETE" signal to terminate the conversation.

    Always explain your thought process step by step.
    """
)

maps_agent = autogen.AssistantAgent(
    name="maps_agent",
    llm_config=llm_config,
    system_message="""You are responsible for processing geographic information and route planning. Your responsibilities are:
    1. Get location coordinates and detailed information
    2. Optimize travel routes
    3. Calculate distances and times
    4. Provide transportation advice
    
    You can use the following functions:
    - get_place_coordinates(place, city): Get location coordinates
    - optimize_route(places, city, preferences): Optimize routes

    "Always call the registered functions to get real-time data. Do NOT fabricate the result yourself."
    Always explain your thought process step by step.
    """
)


maps_agent.register_for_llm(description="Get place coordinates")(get_place_coordinates)
maps_agent.register_for_llm(description="Optimize travel routes")(optimize_route)
maps_agent.register_for_execution()(get_place_coordinates)
maps_agent.register_for_execution()(optimize_route)


weather_agent = autogen.AssistantAgent(
    name="weather_agent",
    llm_config=llm_config,
    system_message="""You are responsible for processing weather information and advice. Your responsibilities are:
    1. Get weather forecast
    2. Analyze weather impact on activities
    3. Provide clothing advice
    4. Suggest best activity time
    
    You can use the following functions:
    - get_weather_with_advice(city, date, activities): Get weather information and advice

    "Always call the registered functions to get real-time data. Do NOT fabricate the result yourself."
    Always explain your thought process step by step.
    """
)
weather_agent.register_for_llm(description="Get weather with advice")(get_weather_with_advice)
weather_agent.register_for_execution()(get_weather_with_advice)

search_agent = autogen.AssistantAgent(
    name="search_agent",
    llm_config=llm_config,
    system_message="""You are responsible for searching for travel-related information. Your responsibilities are:
    1. Search for attractions and activities
    2. Find restaurants and cafes
    3. Provide ratings and reviews
    4. Filter and sort results
    
    You can use the following functions:
    - search_places(query, top_k, preferences): Search for locations
    - search_with_context(query, context, top_k): Search with context

    "Always call the registered functions to get real-time data. Do NOT fabricate the result yourself."
    Always explain your thought process step by step.
    """
)
search_agent.register_for_llm(description="Search for locations")(search_places)
search_agent.register_for_llm(description="Search with context")(search_with_context)
search_agent.register_for_execution()(search_places)
search_agent.register_for_execution()(search_with_context)

report_agent = autogen.AssistantAgent(
    name="report_agent",
    llm_config=llm_config,
    system_message="""You are responsible for generating the final travel report. Your responsibilities are:
    1. Collect the itinerary, weather advice, transportation notes, and attraction ratings provided by other agents
    2. Format all information into a clear, well-structured Markdown document
    3. (Optional) Convert the Markdown into a PDF file when requested
    4. Reply with the Markdown content wrapped inside a ```json fenced block, then finish with a single line containing PLAN_COMPLETE
    
    Always explain your thought process step by step.
    """
)

user_proxy = autogen.UserProxyAgent(
    name="user_proxy",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=10,
    is_termination_msg=lambda x: "PLAN_COMPLETE" in x.get("content", ""),
    code_execution_config={
        "work_dir": "workspace",
        "use_docker": False,
    },
    llm_config=llm_config
)
import re
def extract_final_json(messages):
    for msg in reversed(messages):
        m = re.search(r"```json\s+([\s\S]*?)```", msg["content"])
        if m:
            return json.loads(m.group(1))
    raise RuntimeError("Didn't find final JSON in messages")

def create_trip_plan(user_input: str, start_date: Optional[datetime] = None, trip_name: Optional[str] = None) -> Dict:
    """
    Create a travel plan using Autogen
    
    Args:
        user_input: Natural language description from user
        start_date: Travel start date
        trip_name: Name of the trip
    
    Returns:
        Dict: Dictionary containing travel plan information
    """
    # Initialize chat group with empty messages list
    groupchat = autogen.GroupChat(
        agents=[user_proxy, planner, maps_agent, weather_agent, search_agent, report_agent],
        messages=[],  # Ensure empty messages list for new conversation
        max_round=50
    )
    manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
    
    # Start conversation with clear context
    user_proxy.initiate_chat(
        manager,
        message=f"""Please help me plan a trip:
        User input: {user_input}
        Start date: {start_date.strftime('%Y-%m-%d') if start_date else 'Not specified'}
        Trip name: {trip_name or 'Not specified'}
        
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
        
        Note: This is a new trip planning request. Please ignore any previous conversations.
        """
    )
    
    # Get final result
    plan_dict = extract_final_json(groupchat.messages)
    return plan_dict

def save_trip_plan(plan: Dict, output_dir: str = "reports") -> Path:
    """
    Save travel plan
    
    Args:
        plan: Travel plan dictionary
        output_dir: Output directory
    
    Returns:
        Path: Path to saved file
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"trip_plan_{timestamp}.json"
    filepath = output_dir / filename
    
    # Save plan
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    
    return filepath

if __name__ == "__main__":
    # Example usage
    user_input = "I want to visit Munich for three days, I like coffee shops and outdoor activities, medium budget, prefer walking over taking transportation"
    start_date = datetime.now()
    
    try:
        # Create travel plan
        plan = create_trip_plan(user_input, start_date)
        
        # Save plan
        filepath = save_trip_plan(plan)
        print(f"Travel plan saved to: {filepath}")
        
    except Exception as e:
        print(f"Error: {e}") 