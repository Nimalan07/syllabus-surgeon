import pytest
from services.llm_client import _settings, _json_object

def test_json_object_clean():
    raw = '{"courses": [{"course_name": "Calculus I", "items": []}], "warnings": []}'
    parsed = _json_object(raw)
    assert parsed["courses"][0]["course_name"] == "Calculus I"

def test_json_object_with_markdown_fences():
    raw = '''```json
{
  "courses": [{"course_name": "CS 101", "items": []}],
  "warnings": []
}
```'''
    parsed = _json_object(raw)
    assert parsed["courses"][0]["course_name"] == "CS 101"

def test_json_object_with_trailing_extra_data():
    raw = '''```json
{
  "courses": [{"course_name": "CS 101", "items": []}],
  "warnings": []
}
```
Here are some extra notes and thoughts about the course syllabus!'''
    parsed = _json_object(raw)
    assert parsed["courses"][0]["course_name"] == "CS 101"

def test_json_object_plain_with_trailing_chatter():
    raw = '''Here is the extracted json:
{
  "courses": [{"course_name": "NLP", "items": []}]
}
Note: I extracted this carefully.'''
    parsed = _json_object(raw)
    assert parsed["courses"][0]["course_name"] == "NLP"

def test_ollama_default_settings(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)
    api_key, base_url, model = _settings()
    assert "11434" in base_url

def test_groq_settings_missing_key(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="GROQ_API_KEY is not configured"):
        _settings()

def test_groq_settings_configured(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test123")
    api_key, base_url, model = _settings()
    assert model == "llama-3.3-70b-versatile"
    assert "groq.com" in base_url
