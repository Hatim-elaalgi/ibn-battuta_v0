import requests
import json
import logging
import base64
from typing import Optional, List, Dict, Any

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# LM Studio Configuration
LM_STUDIO_HOST = "http://127.0.0.1:1234"
LM_STUDIO_API_URL = f"{LM_STUDIO_HOST}/api/v1/chat"
MODEL_NAME = "qwen/qwen3-vl-4b"

# Qwen 3 VL 4B optimized parameters
QWEN3_DEFAULTS = {
    "temperature": 0.6,
    "top_p": 0.9,
    "max_output_tokens": 512
}

def _call_lm_studio_api(input_array: List[Dict[str, Any]], system_prompt: str = "", **kwargs) -> str:
    """
    Call LM Studio using the official API format with structured input.
    
    Args:
        input_array: List of input objects with 'type' and content
                    [{"type": "text", "content": "..."}, {"type": "image", "data_url": "..."}]
        system_prompt: Optional system message
        **kwargs: Additional parameters (temperature, max_output_tokens, etc.)
    
    Returns:
        str: The AI's response text
    """
    headers = {"Content-Type": "application/json"}
    
    # Merge with defaults
    params = {**QWEN3_DEFAULTS, **kwargs}
    
    # Build proper LM Studio API request
    payload = {
        "model": MODEL_NAME,
        "input": input_array,
        "temperature": params["temperature"],
        "top_p": params["top_p"],
        "max_output_tokens": params["max_output_tokens"],
        "stream": False
    }
    
    if system_prompt:
        payload["system_prompt"] = system_prompt
    
    logger.info(f"=== LM STUDIO API CALL ===")
    logger.info(f"URL: {LM_STUDIO_API_URL}")
    logger.info(f"Model: {MODEL_NAME}")
    logger.info(f"Input items: {len(input_array)}")
    for i, item in enumerate(input_array):
        logger.info(f"  Item {i}: type={item.get('type')}")
        if item.get('type') == 'text':
            logger.info(f"    Content length: {len(item.get('content', ''))} chars")
        elif item.get('type') == 'image':
            logger.info(f"    Image data_url length: {len(item.get('data_url', ''))} chars")
    logger.info(f"System prompt: {'present' if system_prompt else 'none'}")
    
    try:
        # Validate input structure
        logger.info(f"Payload size: {len(json.dumps(payload))} bytes")
        
        response = requests.post(LM_STUDIO_API_URL, headers=headers, json=payload, timeout=120)
        
        # Handle errors
        if response.status_code != 200:
            logger.error(f"❌ LM Studio error: HTTP {response.status_code}")
            logger.error(f"Response: {response.text}")
            return f"Error from LM Studio: {response.status_code} - {response.text[:200]}"
        
        # Parse successful response
        data = response.json()
        logger.info(f"✅ Success! Response received")
        
        # Extract text from output array
        if 'output' in data and len(data['output']) > 0:
            # Find the message output
            for output_item in data['output']:
                if output_item.get('type') == 'message':
                    response_text = output_item.get('content', '')
                    logger.info(f"Message extracted: {len(response_text)} chars")
                    return response_text
            
            # If no message found, return error
            logger.error(f"No message in output array")
            return "No response text generated"
        else:
            logger.error(f"Unexpected response format: {data}")
            return "Empty response from LM Studio"
    
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error: {e}")
        return "Could not connect to LM Studio (running on port 1234?)"
    except requests.exceptions.Timeout as e:
        logger.error(f"Timeout: {e}")
        return "Vision processing took too long (timeout after 120 seconds)"
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return f"Error: {str(e)}"

def call_local_llm_streaming(
    user_message: str,
    system_prompt: str = "You are a helpful assistant.",
):
    """
    Stream text chunks from LM Studio (Responses API with stream=True).
    Yields string deltas as they arrive.
    Falls back to yielding the full response at once if streaming fails.
    """
    headers = {"Content-Type": "application/json"}
    input_array = [{"type": "text", "content": user_message}]
    payload = {
        "model": MODEL_NAME,
        "input": input_array,
        "temperature": QWEN3_DEFAULTS["temperature"],
        "top_p": QWEN3_DEFAULTS["top_p"],
        "max_output_tokens": QWEN3_DEFAULTS["max_output_tokens"],
        "stream": True,
    }
    if system_prompt:
        payload["system_prompt"] = system_prompt

    try:
        with requests.post(
            LM_STUDIO_API_URL, headers=headers, json=payload,
            stream=True, timeout=120
        ) as resp:
            if resp.status_code != 200:
                yield call_local_llm(user_message, system_prompt)
                return
            for raw_line in resp.iter_lines():
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
                if not line.startswith("data:"):
                    continue
                data_str = line[len("data:"):].strip()
                if data_str == "[DONE]":
                    break
                try:
                    obj = json.loads(data_str)
                except Exception:
                    continue
                # LM Studio Responses API  →  {"type":"message.delta","content":"..."}
                if obj.get("type") == "message.delta":
                    delta = obj.get("content", "")
                    if delta:
                        yield delta
                # LM Studio older / OpenAI-compatible fallback
                elif obj.get("type") == "response.output_text.delta":
                    delta = obj.get("delta", "")
                    if delta:
                        yield delta
                elif "choices" in obj:
                    delta = obj["choices"][0].get("delta", {}).get("content", "")
                    if delta:
                        yield delta
    except Exception as exc:
        logger.error(f"Streaming error: {exc}")
        yield call_local_llm(user_message, system_prompt)


def call_local_llm(
    user_message: str,
    system_prompt: str = "You are a helpful assistant."
) -> str:
    """
    Text-only chat with Qwen 3 VL 4B using official LM Studio API.
    
    Args:
        user_message: The message from the user
        system_prompt: System instruction
    
    Returns:
        str: The AI's response
    """
    logger.info(f"=== TEXT REQUEST ===")
    logger.info(f"Message: {user_message[:100]}...")
    
    # Build structured input array (official LM Studio format)
    input_array = [
        {
            "type": "text",
            "content": user_message
        }
    ]
    
    logger.info(f"Input array: {len(input_array)} items")
    return _call_lm_studio_api(input_array, system_prompt)

def call_local_llm_json(
    user_message: str,
    system_prompt: str = "",
    *,
    max_output_tokens: int = 1500,
    temperature: float = 0.4,
    retry: int = 1,
) -> dict:
    """
    Ask the LLM for a JSON object and parse it.

    Qwen3-VL-4B does not have a reliable native JSON mode, so we ask via
    prompt engineering, strip markdown fences, and extract the first balanced
    JSON object. On parse failure we retry once with a stricter reminder.

    Returns: a dict (or list) parsed from the LLM's response.
    Raises: ValueError if no valid JSON could be extracted after retries.
    """
    strict = (
        "You MUST respond with a single JSON value and nothing else. "
        "No markdown fences. No prose before or after. No commentary. "
        "Strictly valid JSON only.\n\n"
    )
    full_system = (system_prompt + "\n\n" if system_prompt else "") + strict

    for attempt in range(retry + 1):
        raw = _call_lm_studio_api(
            input_array=[{"type": "text", "content": user_message}],
            system_prompt=full_system,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )
        parsed = _extract_json(raw)
        if parsed is not None:
            return parsed
        logger.warning("JSON parse failed (attempt %d). Raw head: %r", attempt + 1, raw[:200])
        # Strengthen reminder for retry
        user_message = (
            "Your previous response was NOT valid JSON. "
            "Reply ONLY with the JSON object — no fences, no commentary.\n\n"
            + user_message
        )

    raise ValueError("LLM did not return valid JSON after retries")


def _extract_json(text: str):
    """Strip markdown fences and extract the first balanced JSON value."""
    if not text:
        return None
    s = text.strip()
    # Remove ```json ... ``` or ``` ... ``` fences if present
    if s.startswith("```"):
        s = s.strip("`")
        if s.lower().startswith("json"):
            s = s[4:]
        s = s.strip()
        # Drop any trailing fence
        if s.endswith("```"):
            s = s[:-3].strip()
    # Find the first { or [ and walk to the matching close
    for opener, closer in (("{", "}"), ("[", "]")):
        start = s.find(opener)
        if start == -1:
            continue
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(s)):
            ch = s[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    candidate = s[start:i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break
    return None


def call_local_llm_with_image(
    user_message: str,
    image_data: str,
    system_prompt: str = "You are a helpful assistant."
) -> str:
    """
    Vision-language chat with Qwen 3 VL 4B using official LM Studio API.
    
    Uses the structured input format from official LM Studio docs:
    https://lmstudio.ai/docs/api/chat
    
    Args:
        user_message: The text question/message
        image_data: Base64-encoded image (data:image/jpeg;base64,...) 
        system_prompt: System instruction
    
    Returns:
        str: The AI's response with vision analysis
    """
    logger.info(f"=== VISION REQUEST ===")
    logger.info(f"Message: '{user_message}'")
    logger.info(f"Image data length: {len(image_data)} chars")
    
    # Build structured input array (official LM Studio format)
    input_array = []
    
    # Add image first
    if image_data:
        if not image_data.startswith("data:"):
            # Ensure it has proper data URI prefix
            image_data = f"data:image/jpeg;base64,{image_data}"
        
        input_array.append({
            "type": "image",
            "data_url": image_data
        })
        logger.info(f"✓ Added image to input array")
    
    # Add text message
    if user_message:
        input_array.append({
            "type": "text",
            "content": user_message
        })
        logger.info(f"✓ Added text to input array")
    
    logger.info(f"Input array: {len(input_array)} items")
    logger.info(f"Sending to LM Studio...")
    
    response = _call_lm_studio_api(input_array, system_prompt)
    
    logger.info(f"=== VISION RESPONSE ===")
    logger.info(f"Response length: {len(response)} chars")
    
    return response
