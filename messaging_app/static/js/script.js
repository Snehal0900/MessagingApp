document.addEventListener("DOMContentLoaded", function () {
    console.log("Conversation ID from Django:", conversationId);
    console.log("Logged in user:", username);

    const messageForm = document.getElementById("messageForm");
    const messageInput = document.getElementById("messageInput");
    const chatBox = document.getElementById("messages");
    const chatList = document.getElementById("chatList");
    const userSearch = document.getElementById("userSearch");
    const searchResults = document.getElementById("searchResults");
    const recipientUsername = document.getElementById("recipientUsername");
    const chatContainer = document.querySelector(".chat-container");
    
    let conversationIdInput = document.getElementById("conversationId");
    let socket = null; // WebSocket connection
    let activeConversationId = null; // Track active conversation
    let socketReady = false; // Track WebSocket readiness

    document.addEventListener("click", function (event) {
        if (!userSearch.contains(event.target) && !searchResults.contains(event.target)) {
            searchResults.style.display = "none"; 
            userSearch.classList.add("search-box-collapsed");
        }
    });

    userSearch.addEventListener("input", function () {
        const query = userSearch.value.trim();
    
        if (query) {
            searchResults.style.display = "block"; // Show results when typing
        } else {
            searchResults.style.display = "none"; // Hide if empty
        }
    });

    userSearch.addEventListener("focus", function () {
        if (userSearch.value.trim()) {
            searchResults.style.display = "block"; // Show if there's text
        }
    });

    //Search user
    userSearch.addEventListener("input", function () {
        const query = userSearch.value.trim();

        if (!query) {
            searchResults.innerHTML = "";
            return;
        }

        fetch(`/search_users/?q=${query}`)
            .then(response => response.json())
            .then(data => {
                searchResults.innerHTML = "";

                data.users.forEach(user => {
                    let userItem = document.createElement("li");
                    userItem.textContent = user.username;
                    userItem.classList.add("search-result-item");

                    userItem.addEventListener("click", function () {
                        openChatWithUser(user.username);
                    });

                    searchResults.appendChild(userItem);
                });
            })
            .catch(error => console.error("Error fetching users:", error));
    });

    //open conversation container for a new user
    function openChatWithUser(username) {
        let messagesContainer = document.getElementById("messages");
        messagesContainer.innerHTML = "";

        fetch(`/get_conversation_id/?username=${username}`)
            .then(response => response.json())
            .then(data => {
                if (data.conversation_id) {
                    console.log("Existing conversation found:", data.conversation_id);
                    addChatToSidebar(data.conversation_id, username);
                    openChat(data.conversation_id, username);
                } else {
                    console.log("No existing conversation. Waiting for first message.");
                    recipientUsername.textContent = username;
                    activeConversationId = null;
                }
            })
            .catch(error => console.error("Error getting conversation ID:", error));
    }

    // Adding user to sidebar after sending a msg
    function addChatToSidebar(convId, participantName) {
        if (!convId) {
            console.error("Skipping chat sidebar addition: Invalid conversation ID.");
            return;
        }

        const existingChat = document.querySelector(`[data-conversation-id="${convId}"]`);
        if (!existingChat) {
            const newChatItem = document.createElement("li");
            newChatItem.classList.add("chat-item");
            newChatItem.dataset.conversationId = convId;
            newChatItem.textContent = participantName;

            newChatItem.addEventListener("click", function () {
                openChat(convId, participantName);
            });

            chatList.appendChild(newChatItem);
        }
    }

    // Opening existing chat from sidebar
    chatList.addEventListener("click", function (event) {
        let chatItem = event.target.closest(".chat-item");
        if (!chatItem) return;

        let conversationId = chatItem.dataset.conversationId;
        let chatUsername = chatItem.textContent.trim();

        openChat(conversationId, chatUsername);
    });

    function openChat(conversationId, chatUsername) {
        console.log("Opening chat:", conversationId, "with", chatUsername);

        if (!recipientUsername || !chatContainer) {
            console.error("Error: recipientUsername or chat container not found!");
            return;
        }

        // Close the existing WebSocket connection if it's for a different conversation
        if (socket && socket.readyState === WebSocket.OPEN && activeConversationId !== conversationId) {
            console.log("Closing existing WebSocket connection for conversation:", activeConversationId);
            socket.close();
        }

        // Update UI
        document.querySelectorAll(".chat-item").forEach(item => item.classList.remove("active"));
        let chatItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (chatItem) chatItem.classList.add("active");

        recipientUsername.textContent = chatUsername || "Unknown User";
        activeConversationId = conversationId;
        conversationIdInput.value = conversationId;

        // Load messages and connect WebSocket
        loadMessages(conversationId);
        connectWebSocket(conversationId);

        chatContainer.style.display = "block";
    }

    //Connecting to websocket
    function connectWebSocket(conversationId) {
        if (!conversationId) {
            console.error("❌ Cannot connect WebSocket: conversationId is null");
            return;
        }

        if (socket) {
            console.log("Closing previous WebSocket connection...");
            socket.close();
        }

        console.log(`🔗 Connecting to WebSocket: ws://127.0.0.1:8000/ws/chat/${conversationId}/`);
        socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/${conversationId}/`);

        activeConversationId = conversationId;
        socketReady = false; // Reset WebSocket readiness

        socket.onopen = function () {
            console.log("WebSocket Connected!");
            socketReady = true;
        };

        socket.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                console.log("WebSocket Message Received:", data); // Ensure message is received
                console.log("Parsed WebSocket message:", data);
                
                if (!data.conversation_id || !data.sender || !data.message) {
                    console.error("Invalid WebSocket message format:", data);
                    return;
                }
        
                // Update sidebar for receiver if it's a new chat
                if (data.sender !== username) { 
                    addChatToSidebar(data.conversation_id, data.sender);
                }
        
                appendMessage(data.message, data.sender, formatTimestamp(data.timestamp));

                console.log("🔄 Starting timestamp updates...");
                setInterval(updateTimestamps, 1000);

            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        socket.onclose = function () {
            console.warn("❌ WebSocket connection closed, attempting reconnect...");
            socketReady = false;
        };

        socket.onerror = function (error) {
            console.error("WebSocket encountered an error:", error);
        };
    }

    function sendWebSocketMessage(messageText) {
        if (!activeConversationId) {
            console.warn("⚠️ No conversation ID, sending message via AJAX...");
            sendMessageViaAJAX(messageText);
            return;
        }
       
        const timestamp = new Date().toISOString()
        socket.send(JSON.stringify({
            sender: username,
            message: messageText,
            conversation_id: activeConversationId,
            timestamp: timestamp
        }));
    }

    function sendMessageViaAJAX(messageText) {
        fetch("/send_message/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCSRFToken()
            },
            body: JSON.stringify({
                recipient: recipientUsername.textContent,
                text: messageText
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.conversation_id) {
                activeConversationId = data.conversation_id;
                conversationIdInput.value = activeConversationId;
                console.log(`✅ New conversation created: ${activeConversationId}`);
    
                addChatToSidebar(activeConversationId, recipientUsername.textContent);
                openChat(activeConversationId, recipientUsername.textContent);
    
                connectWebSocket(activeConversationId);
            }

            messageInput.value = "";
        })
        .catch(error => console.error("Error:", error));
    }

    function getCSRFToken() {
        let cookieValue = null;
        let cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i].trim();
            if (cookie.startsWith("csrftoken=")) {
                cookieValue = cookie.substring("csrftoken=".length, cookie.length);
                break;
            }
        }
        return cookieValue;
    }

    //Click send button to send msgs
    messageForm.addEventListener("submit", function (event) {
        event.preventDefault();

        let messageText = messageInput.value.trim();

        if (!messageText) {
            alert("Message cannot be empty!");
            return;
        }

        sendWebSocketMessage(messageText);
        messageInput.value = "";
    });

    // Adding time and msgs to conversation container
    function formatTimestamp(timestamp) {
        // Ensure timestamp is in correct format
        let time = new Date(timestamp);
        if (isNaN(time.getTime())) {
            console.error("❌ Invalid timestamp format:", timestamp);
            return "Invalid Time";
        }
    
        // Convert to user's local timezone
        const now = new Date();
        const diff = Math.floor((now - time) / 1000); // Difference in seconds
    
        if (diff < 60) return "Just now"; // Less than 1 min
        if (diff < 3600) return `${Math.floor(diff / 60)} min ago`; // Less than 1 hour
        if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`; // Less than 1 day
    
        return time.toLocaleString(); // Show full date-time in local format
    }

    function updateTimestamps() {
        document.querySelectorAll(".timestamp").forEach(element => {
            let timestamp = element.getAttribute("data-time");
            if (!timestamp) return;

            let formattedTime = formatTimestamp(timestamp);
            element.innerText = formattedTime;
        });
    }
    
    function appendMessage(text, sender, timestamp) {
        let messageDiv = document.createElement("div");
        const senderLabel = sender === username ? "You" : sender;
        
        messageDiv.classList.add("message");

        if (sender === username) {
            messageDiv.classList.add("sent");
        } else {
            messageDiv.classList.add("received");
        }

        messageDiv.innerHTML = `<strong>${senderLabel}</strong>: ${text}
        <span class="timestamp">${timestamp}</span>
    `;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Loading older msgs
    function loadMessages(conversationId) {
        fetch(`/messages/${conversationId}/`)
            .then(response => response.json())
            .then(data => {
                let messagesContainer = document.getElementById("messages");
                messagesContainer.innerHTML = ""; // Clear previous messages
    
                data.messages.forEach(message => {
                    appendMessage(message.text, message.sender, formatTimestamp(message.timestamp));
                });
            })
            .catch(error => console.error("Error loading messages:", error));
    }    
});