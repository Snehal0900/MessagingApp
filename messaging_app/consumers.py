import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from .models import Message, Conversation
from datetime import datetime

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close()
            return

        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
       
        try:
            self.conversation = await sync_to_async(Conversation.objects.get)(id=self.conversation_id)
        except Conversation.DoesNotExist:
            await self.close()
            return 
       
        self.room_group_name = f'chat_{self.conversation_id}'
        
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        print("✅ WebSocket connection accepted")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        print(f"🟢 WebSocket received first message: {data}")  # Debug first message

        sender_username = data['sender']
        message_text = data['message']
        conversation_id = data['conversation_id']
        timestamp = datetime.now().isoformat()

        print(f"Received message from {sender_username}: {message_text}")

        sender = await sync_to_async(User.objects.get, thread_sensitive=True)(username=sender_username)
        conversation = await sync_to_async(Conversation.objects.get, thread_sensitive=True)(id=conversation_id)

        try:
            # Create the message
            await sync_to_async(Message.objects.create, thread_sensitive=True)(
                conversation=conversation,
                sender=sender,
                text=message_text
            )

            print(f"Broadcasting message to group: {self.room_group_name}")

            # Broadcast message to the conversation group
            await self.channel_layer.group_send(
                self.room_group_name,  # Use the conversation group name
                {
                    "type": "chat_message",
                    "sender": sender.username,
                    "message": message_text,
                    "conversation_id": conversation_id,
                    "timestamp": timestamp,
                }
            )
        except Exception as e:
            print(f"Error in receive(): {e}")

    async def chat_message(self, event):
        print("📤 Sending WebSocket Message:", event)  # Debugging
        await self.send(text_data=json.dumps({
            "sender": event["sender"],
            "message": event["message"],
            "conversation_id": event["conversation_id"],
            "timestamp": datetime.now().isoformat()
        }))