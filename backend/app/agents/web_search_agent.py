"""
Web Search Agent (Serper Version)
Using Google Serper API and LLM for intelligent search
"""
import openai
from openai import AzureOpenAI  
import os, requests, json
from typing import List, Dict
from app.config import settings
import re

SERPER_KEY = settings.SERPER_API_KEY
SERPER_ENDPOINT = settings.SERPER_ENDPOINT

HEADERS = {"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"}

client = AzureOpenAI(
    api_key=settings.AZURE_OPENAI_API_KEY,
    api_version="2024-12-01-preview",
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
)

def generate_search_queries(query: str, preferences: Dict = None) -> List[str]:
    """Generate optimized search queries using LLM"""
    prompt = f"""Please generate optimized search queries for the following travel search request:
    Original query: {query}
    User preferences: {json.dumps(preferences, ensure_ascii=False) if preferences else "Not specified"}
    
    Please consider:
    1. Search comprehensiveness (attractions, activities, food, etc.)
    2. User's specific interests
    3. Budget constraints
    4. Time constraints
    
    Return format: JSON array containing 3-5 search queries, e.g.:
    ["query1", "query2", "query3"]"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        content = response.choices[0].message.content.strip()
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            content = match.group(0)
        else:
            raise ValueError(f"Cannot parse content: {content}")

        return json.loads(content)
    
    except Exception as e:
        print(f"Error generating search queries: {str(e)}")
        return [query]  # fallback

def filter_and_rank_results(results: List[Dict], preferences: Dict = None) -> List[Dict]:
    """Filter and rank search results using LLM"""
    prompt = f"""Please filter and rank the following search results based on user preferences:
    Search results: {json.dumps(results, ensure_ascii=False, indent=2)}
    User preferences: {json.dumps(preferences, ensure_ascii=False) if preferences else "Not specified"}
    
    Please consider:
    1. Relevance
    2. Ratings and reviews
    3. Match with user interests
    4. Budget compliance
    
    Return format: Same JSON array as input, but sorted and filtered"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        content = response.choices[0].message.content.strip()

        
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            content = match.group(0)
        else:
            raise ValueError(f"Cannot parse content: {content}")

        return json.loads(content)
    except Exception as e:
        print(f"Error filtering results: {str(e)}")
        return results

def search_places(query: str, top_k: int = 5, preferences: Dict = None) -> List[Dict]:
    """
    Intelligent search for travel-related locations
    
    >>> search_places("best coffee shops in Munich", 3, {"budget": "medium", "interests": ["coffee"]})
    [
      {"title": "...", "url": "https://...", "snippet": "...", "rating": 4.5, "price_level": "$$"},
      ...
    ]
    """
    if not SERPER_KEY:
        raise RuntimeError("SERPER_API_KEY not set")

    # Generate optimized search queries
    search_queries = generate_search_queries(query, preferences)
    
    all_results = []
    
    for search_query in search_queries:
        payload = {"q": search_query}
        resp = requests.post(SERPER_ENDPOINT, json=payload, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        # Process local results (Google Maps)
        if "local" in data:
            for item in data["local"]:
                result = {
                    "title": item.get("title"),
                    "url": item.get("website") or item.get("directions"),
                    "snippet": item.get("description", ""),
                    "rating": item.get("rating", 0),
                    "price_level": item.get("price_level", "Unknown"),
                    "type": "local"
                }
                all_results.append(result)

        # Process regular search results
        for item in data.get("organic", []):
            result = {
                "title": item.get("title"),
                "url": item.get("link"),
                "snippet": item.get("snippet", ""),
                "type": "organic"
            }
            all_results.append(result)
    
    # Remove duplicates
    seen = set()
    unique_results = []
    for result in all_results:
        if result["title"] not in seen:
            seen.add(result["title"])
            unique_results.append(result)
    
    # Filter and rank results
    filtered_results = filter_and_rank_results(unique_results, preferences)
    
    return filtered_results[:top_k]

def search_with_context(query: str, context: Dict, top_k: int = 5) -> List[Dict]:
    """Context-aware intelligent search"""
    # Build context-aware search prompt
    prompt = f"""Please optimize the search query based on the following context:
    Original query: {query}
    Context: {json.dumps(context, ensure_ascii=False, indent=2)}
    
    Please generate a more precise search query considering:
    1. Previous search results
    2. User feedback
    3. Time constraints
    4. Location constraints
    
    Return format: Single search query string"""
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        optimized_query = response.choices[0].message.content.strip()
        return search_places(optimized_query, top_k, context.get("preferences"))
    except Exception as e:
        print(f"Error in context-aware search: {str(e)}")
        return search_places(query, top_k)

if __name__ == "__main__":
    try:
        # Example usage
        query = "Best coffee shops in Munich"
        preferences = {
            "budget": "medium",
            "interests": ["coffee", "quiet"],
            "time": "morning"
        }
        
        results = search_places(query, 3, preferences)
        
        print("\nSearch results:")
        for i, result in enumerate(results, 1):
            print(f"\n{i}. {result['title']}")
            print(f"   Link: {result['url']}")
            print(f"   Description: {result['snippet']}")
            if "rating" in result:
                print(f"   Rating: {result['rating']}")
            if "price_level" in result:
                print(f"   Price: {result['price_level']}")
                
    except Exception as e:
        print(f"Error: {e}")


