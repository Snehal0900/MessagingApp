from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
import json
import logging
from .models import Conversation, Message
from django.db.models import Q
from django.shortcuts import render, get_object_or_404
from django.utils.timezone import localtime
from datetime import datetime
from django.utils.timezone import now

logger = logging.getLogger(__name__)
User = get_user_model()

@login_required
def chat_selection(request):
    conversations = Conversation.objects.filter(participants=request.user)
    
    # Get the first conversation by default (or None if no chats exist)
    first_conversation = conversations.first()
    conversation_id = first_conversation.id if first_conversation else None

    context = {
        "conversations": conversations,
        "conversation_id": conversation_id,  # Ensure this is set
    }

    return render(request, "messaging_app/chat_selection.html", context)

@login_required
def chat_page(request, conversation_id):
    conversation = get_object_or_404(Conversation, id=conversation_id)

    # Ensure the user is a participant
    if request.user not in conversation.participants.all():
        return JsonResponse({"error": "Not authorized"}, status=403)

    return render(request, "messaging_app/chat.html", {
        "conversation_id": conversation_id
    })


def update_chat_list(request, conversation_id):
    conversation = get_object_or_404(Conversation, id=conversation_id)
    other_user = conversation.participants.exclude(id=request.user.id).first()

    return JsonResponse({
        "success": True,
        "recipient": other_user.username if other_user else "Unknown"
    })

# Fetch all conversations of the logged-in user
@login_required
def get_conversations(request):
    user = request.user
    conversations = Conversation.objects.filter(participants=user).prefetch_related("messages")

    data = [
        {
            "id": convo.id,
            "participants": [participant.username for participant in convo.participants.all()],
            "last_message": convo.messages.last().text if convo.messages.exists() else "No messages yet"
        }
        for convo in conversations
    ]

    return JsonResponse({"conversations": data})

# Fetch messages for a specific conversation
@login_required
def get_messages(request, conversation_id):
    conversation = get_object_or_404(Conversation, id=conversation_id)

    if request.user not in conversation.participants.all():
        return JsonResponse({"error": "Not authorized"}, status=403)

    messages = conversation.messages.all()
    data = [
        {
            "sender": message.sender.username,
            "text": message.text,
            "timestamp": localtime(message.timestamp).isoformat(),
        }
        for message in messages
    ]
    return JsonResponse({"messages": data})



@login_required
def search_users(request):
    query = request.GET.get("q", "").strip()

    if not query:
        return JsonResponse({"users": []})

    users = User.objects.filter(username__icontains=query).exclude(id=request.user.id)[:10]  # Exclude self
    data = [{"username": user.username} for user in users]

    return JsonResponse({"users": data})


@login_required
def send_message(request):
    if request.method == "POST":
        data = json.loads(request.body)
        sender = request.user
        recipient_username = data.get("recipient")
        text = data.get("text")
        conversation_id = data.get("conversation_id")

        if not recipient_username or not text:
            return JsonResponse({"error": "Recipient and text required"}, status=400)

        recipient = get_object_or_404(User, username=recipient_username)

        # Create conversation only if it doesn't exist
        if not conversation_id:
            conversation = Conversation.objects.create()
            conversation.participants.add(sender, recipient)
        else:
            conversation = get_object_or_404(Conversation, id=conversation_id)

        # Create and save the message
        message = Message.objects.create(conversation=conversation, sender=sender, text=text)

        timestamp = localtime(message.timestamp).isoformat()

        # Send WebSocket message to both users
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{conversation.id}",
            {
                "type": "chat_message",
                "message": message.text,
                "sender": sender.username,
                "conversation_id": conversation.id,
                "timestamp": timestamp,
            }
        )

        return JsonResponse({
            "message": message.text,
            "conversation_id": conversation.id
        })

def get_conversation_id(request):
    recipient_username = request.GET.get("username")
    sender = request.user

    if not recipient_username:
        return JsonResponse({"error": "Recipient username required"}, status=400)

    recipient = get_object_or_404(User, username=recipient_username)

    # Check if a conversation already exists
    conversation = Conversation.objects.filter(participants=sender).filter(participants=recipient).first()

    return JsonResponse({"conversation_id": conversation.id if conversation else None})