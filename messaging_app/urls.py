from django.urls import path
from .views import chat_selection, get_conversations, get_messages, send_message, chat_page, update_chat_list, search_users, get_conversation_id

urlpatterns = [
    path("chat/select/", chat_selection, name="chat_selection"),
    path("conversations/", get_conversations, name="get_conversations"),
    path("messages/<int:conversation_id>/", get_messages, name="get_messages"),
    path("send_message/", send_message, name="send_message"), 
    path("chat/<int:conversation_id>/", chat_page, name="chat_page"), 
    path('update_chat_list/<int:conversation_id>/', update_chat_list, name='update_chat_list'),
    path("search_users/", search_users, name="search_users"),
    path("get_conversation_id/", get_conversation_id, name="get_conversation_id"),
]