# Messaging App

A real-time messaging application built using Django, Django Channels, and WebSockets. This app allows users to send and receive messages in real-time with an interface similar to WhatsApp.

## Features

- User authentication (login & registration)
- Real-time private messaging using WebSockets
- Conversation-based chat system
- Search and select users to chat
- Responsive UI with a chat-style layout

## Technologies Used

- **Backend:** Django, Django Channels, WebSockets
- **Frontend:** Jinja templates, JavaScript, CSS
- **Database:** MySQL
  

## Installation & Setup

### Prerequisites
- Python 3.x
- MySQL

### Steps to Install

1. **Clone the repository**
   ```sh
   git clone https://github.com/yourusername/messaging-app.git
   cd messaging-app
   ```

2. **Create a virtual environment and activate it**
   ```sh
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install dependencies**
   ```sh
   pip install -r requirements.txt
   ```

4. **Configure the database (MySQL)**
   Update `settings.py` with your MySQL database credentials:
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.mysql',
           'NAME': 'messaging_db',
           'USER': 'your_db_user',
           'PASSWORD': 'your_db_password',
           'HOST': 'localhost',
           'PORT': '3306',
       }
   }
   ```

5. **Run database migrations**
   ```sh
   python manage.py makemigrations
   python manage.py migrate
   ```

6. **Start Redis server (Ensure Redis is installed and running)**
   ```sh
   redis-server
   ```

7. **Run Django server with ASGI**
   ```sh
   daphne -b 0.0.0.0 -p 8000 messaging_app.asgi:application
   ```

8. **Open the app in your browser**
   ```sh
   http://127.0.0.1:8000/
   ```

## API Endpoints

### User Authentication
- `POST /register/` - Register a new user
- `POST /login/` - Login a user

### Messaging
- `GET /get_conversations/` - Fetch all conversations
- `GET /get_messages/<conversation_id>/` - Fetch messages in a conversation
- `POST /send_message/` - Send a new message

### User Search
- `GET /search_users/?q=<username>` - Search users by username

## WebSocket Communication
- WebSockets handle real-time message sending and receiving.
- The WebSocket endpoint is: `ws://127.0.0.1:8000/ws/chat/<conversation_id>/`
