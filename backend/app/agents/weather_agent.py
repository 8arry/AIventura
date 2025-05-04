from openai import AzureOpenAI  
import requests, datetime as dt, json
from typing import Dict, List
from datetime import datetime
from app.config import settings
import re

OPENWEATHER_KEY = settings.OPENWEATHER_KEY
if not OPENWEATHER_KEY:
    raise RuntimeError("OPENWEATHER_KEY not set")


client = AzureOpenAI(
    api_key=settings.AZURE_OPENAI_API_KEY,
    api_version="2024-12-01-preview",
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT
)

def get_city_weather(city: str, date: dt.date) -> dict:
    """Returns weather summary for the specified date (±5 days)"""
    url = ("https://api.openweathermap.org/data/2.5/forecast"
           f"?q={city}&units=metric&appid={OPENWEATHER_KEY}")
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # Check for HTTP errors
        data = response.json()
        
        # Check for API errors
        if "cod" in data and data["cod"] != "200":
            raise RuntimeError(f"OpenWeatherMap API error: {data.get('message', 'Unknown error')}")
            
        # Check data format
        if "list" not in data:
            raise RuntimeError("API returned invalid data format")
            
        # Get the forecast closest to noon on the specified date
        target_ts = int(dt.datetime.combine(date, dt.time(12, 0)).timestamp())
        closest = min(data["list"], key=lambda x: abs(x["dt"] - target_ts))
        
        return {
            "temp": closest["main"]["temp"],
            "weather": closest["weather"][0]["main"],
            "description": closest["weather"][0]["description"],
            "humidity": closest["main"]["humidity"],
            "wind_speed": closest["wind"]["speed"],
            "clouds": closest["clouds"]["all"]
        }
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Request failed: {str(e)}")
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Data parsing error: {str(e)}")

def get_weather_advice(weather_data: Dict, activities: List[str] = None) -> Dict:
    """Generate weather-related advice using LLM"""
    
    prompt = f"""Please provide travel advice based on the following weather data:
    Weather data: {json.dumps(weather_data, ensure_ascii=False, indent=2)}
    Planned activities: {json.dumps(activities, ensure_ascii=False) if activities else "Not specified"}
    
    Please consider:
    1. Whether temperature is suitable for outdoor activities
    2. Whether rain gear is needed
    3. Whether wind will affect activities
    4. Suggested clothing
    5. Suggested activity times

    ONLY return the JSON object, do not add any extra text or explanation.
    
    Return format:
    {{
        "suitability": "Suitable/Not very suitable/Not suitable",
        "clothing_advice": "Clothing advice",
        "activity_advice": "Activity advice",
        "preparation": ["Preparation item 1", "Preparation item 2"],
        "best_time": "Suggested activity time",
        "alternative_activities": ["Alternative activity 1", "Alternative activity 2"]
    }}"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        content = response.choices[0].message.content.strip()

        # 尝试提取出真正的 JSON 部分
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            content = match.group(0)
        else:
            raise ValueError(f"Cannot parse content: {content}")

        return json.loads(content)
    except Exception as e:
        print(f"Error generating weather advice: {str(e)}")
        return {
            "suitability": "Unknown",
            "clothing_advice": "Please prepare appropriate clothing based on weather forecast",
            "activity_advice": "Please adjust activity plans based on weather conditions",
            "preparation": ["Check weather forecast", "Prepare rain gear"],
            "best_time": "Decide based on weather conditions",
            "alternative_activities": ["Indoor activities", "Shopping"]
        }

def get_weather_with_advice(city: str, date: dt.date, activities: List[str] = None) -> Dict:
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        return {"error": "Invalid date format, use YYYY-MM-DD"}
    
    print("===> get_weather_with_advice CALLED")
    weather_data = get_city_weather(city, date_obj)
    advice = get_weather_advice(weather_data, activities)
    
    return {
        "weather": weather_data,
        "advice": advice
    }

if __name__ == "__main__":
    try:
        # Example usage
        city = "Munich"
        date = dt.date(2024, 5, 1)
        activities = ["Hiking", "Museum visit", "Coffee shop"]
        
        result = get_weather_with_advice(city, date, activities)
        
        print("\nWeather data:")
        print(f"Temperature: {result['weather']['temp']}°C")
        print(f"Weather: {result['weather']['weather']}")
        print(f"Description: {result['weather']['description']}")
        
        print("\nAdvice:")
        print(f"Suitability: {result['advice']['suitability']}")
        print(f"Clothing advice: {result['advice']['clothing_advice']}")
        print(f"Activity advice: {result['advice']['activity_advice']}")
        print("\nPreparation items:")
        for item in result['advice']['preparation']:
            print(f"- {item}")
        print(f"\nBest time: {result['advice']['best_time']}")
        print("\nAlternative activities:")
        for activity in result['advice']['alternative_activities']:
            print(f"- {activity}")
            
    except Exception as e:
        print(f"Error: {e}")
