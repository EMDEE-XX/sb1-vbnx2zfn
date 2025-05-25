// Main application entry point
document.addEventListener('DOMContentLoaded', function() {
  // Initialize application
  const app = {
    apiBaseUrl: '/api',
    socket: null,
    user: null,
    token: localStorage.getItem('authToken'),
    
    // Initialize app
    init: function() {
      // Setup socket.io
      this.setupSocket();
      
      // Check if user is authenticated
      if (this.token) {
        this.getCurrentUser();
      } else {
        this.loadAuthPage();
      }
      
      // Setup UI event listeners
      this.setupEventListeners();
    },
    
    // Setup Socket.io connection
    setupSocket: function() {
      this.socket = io();
      
      // Setup socket event listeners
      this.socket.on('connect', () => {
        console.log('Socket connected');
        
        // Authenticate socket if user is logged in
        if (this.user) {
          this.authenticateSocket();
        }
      });
      
      this.socket.on('notification:new', (notification) => {
        this.handleNewNotification(notification);
      });
      
      this.socket.on('message:new', (message) => {
        this.handleNewMessage(message);
      });
      
      this.socket.on('user:status', (data) => {
        this.updateUserStatus(data);
      });
      
      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });
    },
    
    // Authenticate socket with user ID
    authenticateSocket: function() {
      if (this.user && this.socket) {
        this.socket.emit('authenticate', this.user.id);
      }
    },
    
    // Get current user info
    getCurrentUser: async function() {
      try {
        const response = await fetch(`${this.apiBaseUrl}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          this.user = data.user;
          this.authenticateSocket();
          this.loadHomePage();
        } else {
          // Token invalid
          localStorage.removeItem('authToken');
          this.loadAuthPage();
        }
      } catch (error) {
        console.error('Error getting current user:', error);
        this.loadAuthPage();
      }
    },
    
    // Login user
    login: async function(email, password) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          this.token = data.token;
          localStorage.setItem('authToken', this.token);
          this.user = data.user;
          this.authenticateSocket();
          this.loadHomePage();
          this.showToast('Logged in successfully', 'success');
        } else {
          this.showToast(data.message || 'Login failed', 'error');
        }
      } catch (error) {
        console.error('Login error:', error);
        this.showToast('Network error, please try again', 'error');
      }
    },
    
    // Register user
    register: async function(username, email, password, fullName) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, email, password, fullName })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          this.token = data.token;
          localStorage.setItem('authToken', this.token);
          this.user = data.user;
          this.authenticateSocket();
          this.loadHomePage();
          this.showToast('Account created successfully', 'success');
        } else {
          this.showToast(data.message || 'Registration failed', 'error');
        }
      } catch (error) {
        console.error('Registration error:', error);
        this.showToast('Network error, please try again', 'error');
      }
    },
    
    // Logout user
    logout: async function() {
      try {
        await fetch(`${this.apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
        
        // Clear user data
        this.user = null;
        this.token = null;
        localStorage.removeItem('authToken');
        
        // Disconnect socket
        if (this.socket) {
          this.socket.disconnect();
        }
        
        this.loadAuthPage();
        this.showToast('Logged out successfully', 'success');
      } catch (error) {
        console.error('Logout error:', error);
      }
    },
    
    // Create a new post
    createPost: async function(content, mediaUrl, communityId) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({ content, mediaUrl, communityId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          this.showToast('Post created successfully', 'success');
          this.loadHomePage(); // Refresh feed
        } else {
          this.showToast(data.message || 'Failed to create post', 'error');
        }
      } catch (error) {
        console.error('Create post error:', error);
        this.showToast('Network error, please try again', 'error');
      }
    },
    
    // Load posts for home feed
    loadPosts: async function(container) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/posts`, {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
        
        const data = await response.json();
        
        if (response.ok) {
          container.innerHTML = '';
          
          if (data.posts.length === 0) {
            container.innerHTML = `
              <div class="bg-white rounded-lg shadow-sm p-6 text-center">
                <div class="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <i class="fas fa-rss text-purple-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold mb-2">Your feed is empty</h3>
                <p class="text-gray-600 mb-4">Follow users or join communities to see posts here</p>
                <button id="explore-button" class="bg-purple-600 text-white px-4 py-2 rounded-full hover:bg-purple-700">
                  Explore Communities
                </button>
              </div>
            `;
            
            document.getElementById('explore-button').addEventListener('click', () => {
              // Navigate to explore page
            });
          } else {
            data.posts.forEach(post => {
              container.innerHTML += this.renderPost(post);
            });
            
            // Setup post interaction listeners
            this.setupPostInteractionListeners();
          }
        } else {
          this.showToast(data.message || 'Failed to load posts', 'error');
        }
      } catch (error) {
        console.error('Load posts error:', error);
        this.showToast('Network error, please try again', 'error');
      }
    },
    
    // Render a post HTML
    renderPost: function(post) {
      return `
        <div class="post-card bg-white rounded-lg shadow-sm overflow-hidden mb-4" data-post-id="${post.id}">
          <div class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <img src="${post.user.profilePicture}" alt="Profile" class="w-10 h-10 rounded-full">
                <div>
                  <h4 class="font-semibold">${post.user.fullName}</h4>
                  <div class="flex items-center space-x-1">
                    <span class="text-gray-500 text-sm">@${post.user.username}</span>
                    <span class="text-gray-500 text-sm">· ${this.formatDate(post.createdAt)}</span>
                  </div>
                </div>
              </div>
              <button class="text-gray-400 hover:text-gray-600 post-menu-btn">
                <i class="fas fa-ellipsis-h"></i>
              </button>
            </div>
            
            <div class="mt-3">
              <p class="text-gray-800">${post.content}</p>
            </div>
            
            ${post.mediaUrl ? `
              <div class="mt-3">
                <img src="${post.mediaUrl}" alt="Post media" class="w-full h-auto rounded-lg">
              </div>
            ` : ''}
            
            <div class="mt-4 flex items-center justify-between text-gray-500">
              <div class="flex space-x-4">
                <button class="flex items-center space-x-1 hover:text-purple-600 post-like-btn ${post.isLiked ? 'text-purple-600' : ''}">
                  <i class="${post.isLiked ? 'fas' : 'far'} fa-heart"></i>
                  <span>${post.likesCount}</span>
                </button>
                <button class="flex items-center space-x-1 hover:text-purple-600 post-comment-btn">
                  <i class="far fa-comment"></i>
                  <span>${post.commentsCount}</span>
                </button>
                <button class="flex items-center space-x-1 hover:text-purple-600 post-share-btn">
                  <i class="fas fa-retweet"></i>
                  <span>Share</span>
                </button>
              </div>
              <div class="flex items-center space-x-2 text-sm">
                <i class="fas fa-lock text-green-500"></i>
                <span>Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      `;
    },
    
    // Format date for display
    formatDate: function(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffSecs < 60) {
        return 'just now';
      } else if (diffMins < 60) {
        return `${diffMins}m`;
      } else if (diffHours < 24) {
        return `${diffHours}h`;
      } else if (diffDays < 7) {
        return `${diffDays}d`;
      } else {
        return date.toLocaleDateString();
      }
    },
    
    // Setup event listeners for post interactions
    setupPostInteractionListeners: function() {
      // Like buttons
      document.querySelectorAll('.post-like-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const postId = e.target.closest('.post-card').dataset.postId;
          const isLiked = button.classList.contains('text-purple-600');
          
          if (isLiked) {
            this.unlikePost(postId, button);
          } else {
            this.likePost(postId, button);
          }
        });
      });
      
      // Comment buttons
      document.querySelectorAll('.post-comment-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const postId = e.target.closest('.post-card').dataset.postId;
          this.showCommentModal(postId);
        });
      });
      
      // Share buttons
      document.querySelectorAll('.post-share-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const postId = e.target.closest('.post-card').dataset.postId;
          this.sharePost(postId);
        });
      });
      
      // Post menu buttons
      document.querySelectorAll('.post-menu-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const postId = e.target.closest('.post-card').dataset.postId;
          this.showPostMenu(postId, button);
        });
      });
    },
    
    // Like a post
    likePost: async function(postId, button) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/posts/${postId}/like`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
        
        if (response.ok) {
          // Update UI
          button.classList.add('text-purple-600');
          const icon = button.querySelector('i');
          icon.classList.remove('far');
          icon.classList.add('fas');
          
          const countSpan = button.querySelector('span');
          countSpan.textContent = (parseInt(countSpan.textContent) + 1).toString();
        } else {
          const data = await response.json();
          this.showToast(data.message || 'Failed to like post', 'error');
        }
      } catch (error) {
        console.error('Like post error:', error);
        this.showToast('Network error, please try again', 'error');
      }
    },
    
    // Unlike a post
    unlikePost: async function(postId, button) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/posts/${postId}/unlike`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
        
        if (response.ok) {
          // Update UI
          button.classList.remove('text-purple-600');
          const icon = button.querySelector('i');
          icon.classList.remove('fas');
          icon.classList.add('far');
          
          const countSpan = button.querySelector('span');
          countSpan.textContent = (parseInt(countSpan.textContent) - 1).toString();
        } else {
          const data = await response.json();
          this.showToast(data.message || 'Failed to unlike post', 'error');
        }
      } catch (error) {
        console.error('Unlike post error:', error);
        this.showToast('Network error, please try again', 'error');
      }
    },
    
    // Show comment modal
    showCommentModal: function(postId) {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Add Comment</h3>
            <button class="text-gray-500 hover:text-gray-700 close-modal-btn">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <textarea id="comment-content" placeholder="Write your comment..." class="w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
          <div class="flex justify-end">
            <button id="submit-comment-btn" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
              Post Comment
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Setup modal event listeners
      modal.querySelector('.close-modal-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
      });
      
      modal.querySelector('#submit-comment-btn').addEventListener('click', async () => {
        const content = modal.querySelector('#comment-content').value.trim();
        
        if (content) {
          try {
            const response = await fetch(`${this.apiBaseUrl}/posts/${postId}/comment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
              },
              body: JSON.stringify({ content })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              document.body.removeChild(modal);
              this.showToast('Comment added successfully', 'success');
              
              // Update comment count
              const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
              const commentBtn = postCard.querySelector('.post-comment-btn');
              const countSpan = commentBtn.querySelector('span');
              countSpan.textContent = (parseInt(countSpan.textContent) + 1).toString();
            } else {
              this.showToast(data.message || 'Failed to add comment', 'error');
            }
          } catch (error) {
            console.error('Add comment error:', error);
            this.showToast('Network error, please try again', 'error');
          }
        } else {
          this.showToast('Comment cannot be empty', 'error');
        }
      });
    },
    
    // Share post
    sharePost: function(postId) {
      // For now, just copy the URL to clipboard
      const postUrl = `${window.location.origin}/post/${postId}`;
      
      navigator.clipboard.writeText(postUrl)
        .then(() => {
          this.showToast('Post link copied to clipboard', 'success');
        })
        .catch(err => {
          console.error('Copy to clipboard failed:', err);
          this.showToast('Failed to copy link', 'error');
        });
    },
    
    // Show post menu
    showPostMenu: function(postId, button) {
      // Create menu
      const menu = document.createElement('div');
      menu.className = 'absolute bg-white shadow-lg rounded-lg py-2 z-10 w-48';
      menu.style.top = `${button.offsetTop + button.offsetHeight}px`;
      menu.style.right = '1rem';
      
      menu.innerHTML = `
        <button class="w-full text-left px-4 py-2 hover:bg-purple-50 text-gray-700">
          <i class="fas fa-bookmark mr-2"></i> Save post
        </button>
        <button class="w-full text-left px-4 py-2 hover:bg-purple-50 text-gray-700">
          <i class="fas fa-bell-slash mr-2"></i> Mute this user
        </button>
        <button class="w-full text-left px-4 py-2 hover:bg-purple-50 text-gray-700">
          <i class="fas fa-flag mr-2"></i> Report post
        </button>
      `;
      
      // Add to document
      document.body.appendChild(menu);
      
      // Close when clicking outside
      const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== button) {
          document.body.removeChild(menu);
          document.removeEventListener('click', closeMenu);
        }
      };
      
      // Add click listener
      setTimeout(() => {
        document.addEventListener('click', closeMenu);
      }, 0);
    },
    
    // Show toast notification
    showToast: function(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      
      document.body.appendChild(toast);
      
      // Remove after animation completes
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 3000);
    },
    
    // Handle new notification
    handleNewNotification: function(notification) {
      let message = '';
      
      switch(notification.type) {
        case 'new_follower':
          message = 'Someone started following you';
          break;
        case 'post_like':
          message = 'Someone liked your post';
          break;
        case 'post_comment':
          message = 'Someone commented on your post';
          break;
        case 'new_post':
          message = 'New post from someone you follow';
          break;
        default:
          message = 'New notification';
      }
      
      this.showToast(message, 'info');
      
      // Update notification badge/counter
      this.updateNotificationCounter();
    },
    
    // Handle new message
    handleNewMessage: function(message) {
      this.showToast('New message received', 'info');
      
      // Update message badge/counter
      this.updateMessageCounter();
    },
    
    // Update user online status
    updateUserStatus: function(data) {
      // Update UI to show user status
      const userElements = document.querySelectorAll(`[data-user-id="${data.userId}"]`);
      
      userElements.forEach(element => {
        const statusIndicator = element.querySelector('.status-indicator');
        
        if (statusIndicator) {
          if (data.status === 'online') {
            statusIndicator.classList.remove('bg-gray-300');
            statusIndicator.classList.add('bg-green-500');
          } else {
            statusIndicator.classList.remove('bg-green-500');
            statusIndicator.classList.add('bg-gray-300');
          }
        }
      });
    },
    
    // Update notification counter
    updateNotificationCounter: function() {
      const counter = document.querySelector('#notification-counter');
      
      if (counter) {
        const count = parseInt(counter.textContent) || 0;
        counter.textContent = count + 1;
        counter.classList.remove('hidden');
      }
    },
    
    // Update message counter
    updateMessageCounter: function() {
      const counter = document.querySelector('#message-counter');
      
      if (counter) {
        const count = parseInt(counter.textContent) || 0;
        counter.textContent = count + 1;
        counter.classList.remove('hidden');
      }
    },
    
    // Load authentication page
    loadAuthPage: function() {
      const appContainer = document.getElementById('app');
      
      appContainer.innerHTML = `
        <div class="min-h-screen gradient-bg flex items-center justify-center p-4">
          <div class="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
            <div class="text-center mb-8">
              <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-lock text-purple-600 text-2xl"></i>
              </div>
              <h1 class="text-2xl font-bold">VoiceFree</h1>
              <p class="text-gray-600">Speak freely, securely.</p>
            </div>
            
            <div class="mb-6">
              <div class="flex border-b">
                <button id="login-tab" class="flex-1 py-2 px-4 text-center border-b-2 border-purple-600 text-purple-600 font-medium">Login</button>
                <button id="register-tab" class="flex-1 py-2 px-4 text-center text-gray-500">Register</button>
              </div>
            </div>
            
            <div id="login-form" class="auth-form">
              <div class="mb-4">
                <label for="login-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="login-email" placeholder="you@example.com" required>
              </div>
              <div class="mb-6">
                <label for="login-password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" id="login-password" placeholder="••••••••" required>
              </div>
              <button id="login-button" type="submit">Login</button>
            </div>
            
            <div id="register-form" class="auth-form hidden">
              <div class="mb-4">
                <label for="register-name" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" id="register-name" placeholder="John Doe" required>
              </div>
              <div class="mb-4">
                <label for="register-username" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" id="register-username" placeholder="johndoe" required>
              </div>
              <div class="mb-4">
                <label for="register-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="register-email" placeholder="you@example.com" required>
              </div>
              <div class="mb-6">
                <label for="register-password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" id="register-password" placeholder="••••••••" required>
              </div>
              <button id="register-button" type="submit">Create Account</button>
            </div>
            
            <div class="mt-6 text-center text-sm text-gray-600">
              <p>By signing up, you agree to our <a href="#" class="text-purple-600 hover:underline">Terms</a> and <a href="#" class="text-purple-600 hover:underline">Privacy Policy</a>.</p>
            </div>
          </div>
        </div>
      `;
      
      // Setup auth page event listeners
      document.getElementById('login-tab').addEventListener('click', () => {
        document.getElementById('login-tab').classList.add('border-b-2', 'border-purple-600', 'text-purple-600');
        document.getElementById('register-tab').classList.remove('border-b-2', 'border-purple-600', 'text-purple-600');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
      });
      
      document.getElementById('register-tab').addEventListener('click', () => {
        document.getElementById('register-tab').classList.add('border-b-2', 'border-purple-600', 'text-purple-600');
        document.getElementById('login-tab').classList.remove('border-b-2', 'border-purple-600', 'text-purple-600');
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
      });
      
      document.getElementById('login-button').addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (email && password) {
          this.login(email, password);
        } else {
          this.showToast('Please fill in all fields', 'error');
        }
      });
      
      document.getElementById('register-button').addEventListener('click', () => {
        const fullName = document.getElementById('register-name').value;
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        if (fullName && username && email && password) {
          this.register(username, email, password, fullName);
        } else {
          this.showToast('Please fill in all fields', 'error');
        }
      });
    },
    
    // Load home page
    loadHomePage: function() {
      const appContainer = document.getElementById('app');
      
      appContainer.innerHTML = `
        <!-- Navigation -->
        <nav class="gradient-bg text-white shadow-lg">
          <div class="container mx-auto px-4 py-3 flex justify-between items-center">
            <div class="flex items-center space-x-4">
              <button id="menu-toggle" class="md:hidden text-white focus:outline-none">
                <i class="fas fa-bars text-xl"></i>
              </button>
              <a href="#" class="flex items-center space-x-2">
                <div class="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <i class="fas fa-lock text-purple-600"></i>
                </div>
                <span class="font-bold text-xl">VoiceFree</span>
              </a>
            </div>
            
            <div class="hidden md:flex items-center space-x-6">
              <a href="#" class="hover:text-purple-200 transition">
                <i class="fas fa-home mr-1"></i> Home
              </a>
              <a href="#" class="hover:text-purple-200 transition">
                <i class="fas fa-compass mr-1"></i> Explore
              </a>
              <a href="#" class="hover:text-purple-200 transition relative">
                <i class="fas fa-bell mr-1"></i> Notifications
                <span id="notification-counter" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center hidden">0</span>
              </a>
              <a href="#" class="hover:text-purple-200 transition relative">
                <i class="fas fa-envelope mr-1"></i> Messages
                <span id="message-counter" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center hidden">0</span>
              </a>
            </div>
            
            <div class="flex items-center space-x-4">
              <div class="relative hidden md:block">
                <input type="text" placeholder="Search" class="bg-white bg-opacity-20 rounded-full py-1 px-4 text-white placeholder-white placeholder-opacity-70 focus:outline-none focus:ring-2 focus:ring-purple-300">
                <i class="fas fa-search absolute right-3 top-2 text-white opacity-70"></i>
              </div>
              <div class="relative">
                <img src="${this.user ? this.user.profilePicture : 'https://ui-avatars.com/api/?name=User&background=random'}" alt="Profile" class="w-8 h-8 rounded-full cursor-pointer border-2 border-white">
                <div class="encryption-badge absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <i class="fas fa-lock text-white text-xs"></i>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <!-- Mobile Search -->
        <div class="md:hidden bg-white shadow-sm">
          <div class="container mx-auto px-4 py-2">
            <div class="relative">
              <input type="text" placeholder="Search VoiceFree" class="w-full bg-gray-100 rounded-full py-2 px-4 text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-300">
              <i class="fas fa-search absolute right-3 top-3 text-gray-500"></i>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="container mx-auto px-4 py-6 flex">
          <!-- Side Drawer -->
          <div id="side-drawer" class="drawer closed md:open bg-white shadow-lg md:shadow-none rounded-r-lg md:rounded-none fixed md:static w-3/4 md:w-1/4 lg:w-1/5 h-full z-40">
            <div class="p-4">
              <div class="flex items-center space-x-3 mb-8">
                <img src="${this.user ? this.user.profilePicture : 'https://ui-avatars.com/api/?name=User&background=random'}" alt="Profile" class="w-12 h-12 rounded-full border-2 border-purple-500">
                <div>
                  <h3 class="font-bold">${this.user ? this.user.fullName : 'Guest User'}</h3>
                  <p class="text-gray-500 text-sm">@${this.user ? this.user.username : 'guest'}</p>
                </div>
              </div>
              
              <div class="space-y-1 mb-8">
                <a href="#" class="flex items-center space-x-3 p-2 rounded-lg hover:bg-purple-50 text-purple-700">
                  <i class="fas fa-user w-6 text-center"></i>
                  <span>Profile</span>
                </a>
                <a href="#" class="flex items-center space-x-3 p-2 rounded-lg hover:bg-purple-50 text-gray-700">
                  <i class="fas fa-users w-6 text-center"></i>
                  <span>Communities</span>
                </a>
                <a href="#" class="flex items-center space-x-3 p-2 rounded-lg hover:bg-purple-50 text-gray-700">
                  <i class="fas fa-shield-alt w-6 text-center"></i>
                  <span>Privacy Center</span>
                </a>
                <a href="#" class="flex items-center space-x-3 p-2 rounded-lg hover:bg-purple-50 text-gray-700">
                  <i class="fas fa-cog w-6 text-center"></i>
                  <span>Settings</span>
                </a>
              </div>
              
              <div class="mb-8">
                <h4 class="font-semibold text-gray-500 uppercase text-xs mb-2">Your Communities</h4>
                <div class="space-y-2" id="user-communities">
                  <div class="flex items-center justify-center py-4">
                    <div class="w-8 h-8 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                  </div>
                </div>
              </div>
              
              <div class="p-4 bg-purple-50 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-semibold text-sm">Privacy Status</h4>
                  <i class="fas fa-lock text-purple-600"></i>
                </div>
                <p class="text-xs text-gray-600 mb-3">All your content is end-to-end encrypted. Only you and your recipients can read what you share.</p>
                <div class="flex items-center text-xs text-purple-600 font-medium">
                  <i class="fas fa-shield-alt mr-1"></i>
                  <span>Verified Encryption</span>
                </div>
              </div>
              
              <button id="logout-button" class="mt-8 w-full flex items-center justify-center space-x-2 p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                <i class="fas fa-sign-out-alt"></i>
                <span>Log Out</span>
              </button>
            </div>
          </div>

          <!-- Overlay for mobile drawer -->
          <div id="overlay" class="hidden fixed inset-0 bg-black bg-opacity-50 z-30"></div>

          <!-- Main Feed -->
          <div class="w-full md:w-2/4 lg:w-3/5 px-0 md:px-4">
            <!-- Create Post -->
            <div class="bg-white rounded-lg shadow-sm mb-6">
              <div class="p-4 border-b">
                <h3 class="font-semibold text-lg">Create Post</h3>
              </div>
              <div class="p-4">
                <div class="flex items-start space-x-3 mb-4">
                  <img src="${this.user ? this.user.profilePicture : 'https://ui-avatars.com/api/?name=User&background=random'}" alt="Profile" class="w-10 h-10 rounded-full">
                  <textarea id="post-content" placeholder="What's on your mind?" class="flex-1 border-0 focus:ring-0 resize-none text-gray-700 placeholder-gray-400" rows="2"></textarea>
                </div>
                
                <div class="flex items-center justify-between border-t pt-4">
                  <div class="flex space-x-2">
                    <button id="post-image-btn" class="flex items-center space-x-1 text-gray-500 hover:text-purple-600 px-3 py-1 rounded-full hover:bg-purple-50">
                      <i class="fas fa-image text-purple-500"></i>
                      <span class="text-sm">Photo</span>
                    </button>
                    <button id="post-video-btn" class="flex items-center space-x-1 text-gray-500 hover:text-purple-600 px-3 py-1 rounded-full hover:bg-purple-50">
                      <i class="fas fa-video text-purple-500"></i>
                      <span class="text-sm">Video</span>
                    </button>
                    <button id="post-location-btn" class="flex items-center space-x-1 text-gray-500 hover:text-purple-600 px-3 py-1 rounded-full hover:bg-purple-50">
                      <i class="fas fa-map-marker-alt text-purple-500"></i>
                      <span class="text-sm">Location</span>
                    </button>
                  </div>
                  <button id="submit-post-btn" class="gradient-bg text-white px-4 py-1 rounded-full text-sm font-medium hover:opacity-90">
                    Post
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Privacy Notice -->
            <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <i class="fas fa-shield-alt text-blue-500 text-xl mt-1"></i>
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-blue-800">Your Voice is Protected</h3>
                  <div class="mt-2 text-sm text-blue-700">
                    <p>VoiceFree uses military-grade encryption to ensure your posts, messages, and media remain private. Speak freely without fear of surveillance.</p>
                  </div>
                  <div class="mt-4">
                    <button class="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
                      Learn more about our encryption
                      <i class="fas fa-chevron-right ml-1 text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Posts Feed -->
            <div id="posts-container" class="space-y-6">
              <div class="flex justify-center">
                <div class="w-12 h-12 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
            </div>
          </div>
          
          <!-- Right Sidebar -->
          <div class="hidden lg:block w-1/5">
            <div class="bg-white rounded-lg shadow-sm p-4 mb-6">
              <h3 class="font-semibold text-lg mb-4">Trending Now</h3>
              <div class="space-y-4">
                <div>
                  <h4 class="font-medium text-sm text-gray-500">Politics · Trending</h4>
                  <h3 class="font-bold">#TransparencyNow</h3>
                  <p class="text-gray-500 text-sm mt-1">45.2K posts</p>
                </div>
                <div>
                  <h4 class="font-medium text-sm text-gray-500">Activism · Trending</h4>
                  <h3 class="font-bold">#DigitalRights</h3>
                  <p class="text-gray-500 text-sm mt-1">32.7K posts</p>
                </div>
                <div>
                  <h4 class="font-medium text-sm text-gray-500">Global · Trending</h4>
                  <h3 class="font-bold">#WhistleblowerProtection</h3>
                  <p class="text-gray-500 text-sm mt-1">28.9K posts</p>
                </div>
              </div>
              <button class="text-purple-600 font-medium text-sm mt-4 w-full text-left">Show more</button>
            </div>
            
            <div class="bg-white rounded-lg shadow-sm p-4">
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-lg">Suggested for You</h3>
                <button class="text-sm text-gray-500">See All</button>
              </div>
              <div class="space-y-4" id="suggested-users">
                <div class="flex items-center justify-center py-4">
                  <div class="w-8 h-8 border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            </div>
            
            <div class="mt-6 text-xs text-gray-500 space-y-2">
              <div class="flex flex-wrap gap-2">
                <a href="#" class="hover:underline">Terms</a>
                <a href="#" class="hover:underline">Privacy</a>
                <a href="#" class="hover:underline">Cookies</a>
                <a href="#" class="hover:underline">Accessibility</a>
                <a href="#" class="hover:underline">Ads info</a>
              </div>
              <p>© 2023 VoiceFree, Inc.</p>
            </div>
          </div>
        </div>

        <!-- Mobile Bottom Navigation -->
        <div class="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 md:hidden z-40">
          <div class="flex justify-around items-center py-3">
            <a href="#" class="text-purple-600">
              <i class="fas fa-home text-xl"></i>
            </a>
            <a href="#" class="text-gray-500">
              <i class="fas fa-compass text-xl"></i>
            </a>
            <a href="#" class="text-gray-500">
              <i class="fas fa-plus-square text-xl"></i>
            </a>
            <a href="#" class="text-gray-500">
              <i class="fas fa-bell text-xl"></i>
            </a>
            <a href="#" class="text-gray-500">
              <i class="fas fa-user text-xl"></i>
            </a>
          </div>
        </div>
      `;
      
      // Setup home page event listeners
      this.setupHomePageListeners();
      
      // Load posts
      this.loadPosts(document.getElementById('posts-container'));
    },
    
    // Setup home page event listeners
    setupHomePageListeners: function() {
      // Mobile menu toggle
      const menuToggle = document.getElementById('menu-toggle');
      const sideDrawer = document.getElementById('side-drawer');
      const overlay = document.getElementById('overlay');
      
      if (menuToggle && sideDrawer && overlay) {
        menuToggle.addEventListener('click', () => {
          sideDrawer.classList.toggle('closed');
          sideDrawer.classList.toggle('open');
          overlay.classList.toggle('hidden');
        });
        
        overlay.addEventListener('click', () => {
          sideDrawer.classList.add('closed');
          sideDrawer.classList.remove('open');
          overlay.classList.add('hidden');
        });
      }
      
      // Post submission
      const submitPostBtn = document.getElementById('submit-post-btn');
      const postContent = document.getElementById('post-content');
      
      if (submitPostBtn && postContent) {
        submitPostBtn.addEventListener('click', () => {
          const content = postContent.value.trim();
          
          if (content) {
            this.createPost(content);
            postContent.value = '';
          } else {
            this.showToast('Post content cannot be empty', 'error');
          }
        });
      }
      
      // Logout button
      const logoutButton = document.getElementById('logout-button');
      
      if (logoutButton) {
        logoutButton.addEventListener('click', () => {
          this.logout();
        });
      }
      
      // Encryption status simulation
      setInterval(() => {
        const badges = document.querySelectorAll('.encryption-badge');
        badges.forEach(badge => {
          badge.classList.toggle('bg-green-500');
          badge.classList.toggle('bg-blue-500');
          setTimeout(() => {
            badge.classList.toggle('bg-green-500');
            badge.classList.toggle('bg-blue-500');
          }, 300);
        });
      }, 5000);
    },
    
    // Setup general event listeners
    setupEventListeners: function() {
      // Nothing global yet
    }
  };
  
  // Initialize app
  app.init();
});