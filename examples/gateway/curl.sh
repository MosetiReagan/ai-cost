#!/bin/bash
# Example sending a chat completion request to the AI Cost Gateway

API_KEY="ac_live_demo_prod_chatbot_987654321"

echo "Sending request to AI Cost Gateway at http://localhost:4000/v1/chat/completions..."

curl -i -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "x-environment: production" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      { "role": "system", "content": "You are a helpful coding assistant." },
      { "role": "user", "content": "What is the time complexity of quicksort in the average and worst case?" }
    ]
  }'
