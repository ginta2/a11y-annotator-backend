// UI Controller for A11y Annotator
class A11yAnnotatorUI {
  constructor() {
    this.currentSpec = null;
    this.dragIndex = null;
    this.isLoading = false;
    
    this.initializeElements();
    this.bindEvents();
    this.loadUserProfile();
  }

  initializeElements() {
    // Buttons
    this.proposeBtn = document.getElementById('propose-order');
    this.pasteBtn = document.getElementById('paste-annotated');
    this.exportBtn = document.getElementById('export-spec');
    this.copyJsonBtn = document.getElementById('copy-json');
    this.copyMarkdownBtn = document.getElementById('copy-markdown');
    this.testApiBtn = document.getElementById('test-api');
    
    // API Key input
    this.apiKeyInput = document.getElementById('api-key-input');
    
    // Platform toggle
    this.platformOptions = document.querySelectorAll('.platform-option');
    
    // Content areas
    this.focusList = document.getElementById('focus-list');
    this.loadingDiv = document.getElementById('loading');
    this.emptyState = document.getElementById('empty-state');
    this.errorMessage = document.getElementById('error-message');
    this.successMessage = document.getElementById('success-message');
    this.stats = document.getElementById('stats');
    this.totalItems = document.getElementById('total-items');
    this.interactiveItems = document.getElementById('interactive-items');
    this.exportSection = document.querySelector('.export-section');
  }

  bindEvents() {
    // Button events
    this.proposeBtn.addEventListener('click', () => this.proposeFocusOrder());
    this.pasteBtn.addEventListener('click', () => this.pasteAnnotated());
    this.exportBtn.addEventListener('click', () => this.exportSpec());
    this.copyJsonBtn.addEventListener('click', () => this.copyToClipboard('json'));
    this.copyMarkdownBtn.addEventListener('click', () => this.copyToClipboard('markdown'));
    this.testApiBtn.addEventListener('click', () => this.testApiConnection());
    
    // API Key input
    this.apiKeyInput.addEventListener('input', () => this.saveApiKey());
    
    // Platform toggle
    this.platformOptions.forEach(option => {
      option.addEventListener('click', (e) => this.setPlatform(e.target.dataset.platform));
    });

    // Listen for messages from plugin
    window.addEventListener('message', (event) => this.handleMessage(event.data.pluginMessage));
  }

  async loadUserProfile() {
    try {
      const profile = await this.sendMessage('get-profile');
      this.setPlatform(profile.platform || 'web');
      
      // Load API key if available
      if (profile.apiKey) {
        this.apiKeyInput.value = profile.apiKey;
      }
    } catch (error) {
      console.log('No saved profile found, using defaults');
      this.setPlatform('web');
    }
  }

  setPlatform(platform) {
    this.platformOptions.forEach(option => {
      option.classList.toggle('active', option.dataset.platform === platform);
    });
    this.saveProfile({ platform });
  }

  getCurrentPlatform() {
    return document.querySelector('.platform-option.active').dataset.platform;
  }

  async proposeFocusOrder() {
    this.setLoading(true);
    this.hideMessages();
    
    try {
      const spec = await this.sendMessage('propose-focus-order', {
        platform: this.getCurrentPlatform()
      });
      
      this.currentSpec = spec;
      this.renderFocusList(spec.items);
      this.updateStats(spec);
      this.showSuccess('Focus order generated successfully!');
      this.enableActions(true);
    } catch (error) {
      this.showError(`Failed to generate focus order: ${error.message}`);
    } finally {
      this.setLoading(false);
    }
  }

  async pasteAnnotated() {
    if (!this.currentSpec) return;
    
    try {
      await this.sendMessage('paste-annotated-frame', {
        spec: this.currentSpec
      });
      this.showSuccess('Annotated frame pasted successfully!');
    } catch (error) {
      this.showError(`Failed to paste annotations: ${error.message}`);
    }
  }

  async exportSpec() {
    if (!this.currentSpec) return;
    
    try {
      const exportData = await this.sendMessage('export-spec', {
        spec: this.currentSpec
      });
      
      this.exportData = exportData;
      this.exportSection.classList.remove('hidden');
      this.showSuccess('Spec exported successfully!');
    } catch (error) {
      this.showError(`Failed to export spec: ${error.message}`);
    }
  }

  async copyToClipboard(type) {
    if (!this.exportData) return;
    
    const content = type === 'json' ? this.exportData.json : this.exportData.markdown;
    
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        this.showSuccess(`${type.toUpperCase()} copied to clipboard!`);
      } else {
        // Fallback: Create a temporary textarea for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.showSuccess(`${type.toUpperCase()} copied to clipboard! (fallback)`);
      }
    } catch (error) {
      this.showError(`Failed to copy ${type}: ${error.message}`);
    }
  }

  renderFocusList(items) {
    if (!items || items.length === 0) {
      this.showEmptyState();
      return;
    }

    this.focusList.innerHTML = '';
    
    items.forEach((item, index) => {
      const itemElement = this.createFocusItem(item, index);
      this.focusList.appendChild(itemElement);
    });

    this.focusList.classList.remove('hidden');
    this.emptyState.classList.add('hidden');
  }

  createFocusItem(item, index) {
    const div = document.createElement('div');
    div.className = 'focus-item';
    div.draggable = true;
    div.dataset.index = index;
    
    div.innerHTML = `
      <div class="focus-order">${item.order}</div>
      <div class="focus-content">
        <div class="focus-name">${item.customName || item.name}</div>
        <div class="focus-meta">${item.elementType} • ${item.source}</div>
      </div>
      <div class="focus-actions">
        <button class="action-button edit-btn" title="Edit name">✏️</button>
        <button class="action-button delete-btn" title="Remove">🗑️</button>
      </div>
    `;

    // Drag events
    div.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
    div.addEventListener('dragover', (e) => this.handleDragOver(e));
    div.addEventListener('drop', (e) => this.handleDrop(e, index));
    div.addEventListener('dragend', (e) => this.handleDragEnd(e));

    // Action events
    const editBtn = div.querySelector('.edit-btn');
    const deleteBtn = div.querySelector('.delete-btn');
    
    editBtn.addEventListener('click', () => this.editItemName(item, index));
    deleteBtn.addEventListener('click', () => this.deleteItem(index));

    return div;
  }

  handleDragStart(e, index) {
    this.dragIndex = index;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async handleDrop(e, dropIndex) {
    e.preventDefault();
    
    if (this.dragIndex === null || this.dragIndex === dropIndex) return;
    
    try {
      const newItems = this.currentSpec.items.slice();
      const draggedItem = newItems.splice(this.dragIndex, 1)[0];
      newItems.splice(dropIndex, 0, draggedItem);
      
      // Update order numbers
      newItems.forEach((item, index) => {
        item.order = index + 1;
        item.source = 'manual';
      });
      
      this.currentSpec.items = newItems;
      this.renderFocusList(newItems);
      this.updateStats(this.currentSpec);
      
      // Save updated spec
      await this.sendMessage('save-spec', { spec: this.currentSpec });
      
    } catch (error) {
      this.showError(`Failed to reorder: ${error.message}`);
    }
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    this.dragIndex = null;
  }

  async editItemName(item, index) {
    const newName = prompt('Edit item name:', item.customName || item.name);
    if (newName === null || newName.trim() === '') return;
    
    try {
      this.currentSpec.items[index].customName = newName.trim();
      this.currentSpec.items[index].source = 'manual';
      this.currentSpec.updatedAt = Date.now();
      
      this.renderFocusList(this.currentSpec.items);
      await this.sendMessage('save-spec', { spec: this.currentSpec });
      
    } catch (error) {
      this.showError(`Failed to edit name: ${error.message}`);
    }
  }

  async deleteItem(index) {
    if (!confirm('Remove this item from focus order?')) return;
    
    try {
      this.currentSpec.items.splice(index, 1);
      
      // Update order numbers
      this.currentSpec.items.forEach((item, idx) => {
        item.order = idx + 1;
        item.source = 'manual';
      });
      
      this.currentSpec.updatedAt = Date.now();
      this.renderFocusList(this.currentSpec.items);
      this.updateStats(this.currentSpec);
      
      await this.sendMessage('save-spec', { spec: this.currentSpec });
      
    } catch (error) {
      this.showError(`Failed to delete item: ${error.message}`);
    }
  }

  updateStats(spec) {
    const total = spec.items.length;
    const interactive = spec.items.filter(item => item.isInteractive).length;
    
    this.totalItems.textContent = `${total} item${total !== 1 ? 's' : ''}`;
    this.interactiveItems.textContent = `${interactive} interactive`;
    this.stats.classList.remove('hidden');
  }

  showEmptyState() {
    this.focusList.classList.add('hidden');
    this.emptyState.classList.remove('hidden');
    this.stats.classList.add('hidden');
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.proposeBtn.disabled = loading;
    
    if (loading) {
      this.loadingDiv.classList.remove('hidden');
      this.focusList.classList.add('hidden');
      this.emptyState.classList.add('hidden');
    } else {
      this.loadingDiv.classList.add('hidden');
    }
  }

  enableActions(enabled) {
    this.pasteBtn.disabled = !enabled;
    this.exportBtn.disabled = !enabled;
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden');
    this.successMessage.classList.add('hidden');
  }

  showSuccess(message) {
    this.successMessage.textContent = message;
    this.successMessage.classList.remove('hidden');
    this.errorMessage.classList.add('hidden');
  }

  hideMessages() {
    this.errorMessage.classList.add('hidden');
    this.successMessage.classList.add('hidden');
  }

  async saveProfile(updates) {
    try {
      await this.sendMessage('save-profile', updates);
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  }

  async saveApiKey() {
    const apiKey = this.apiKeyInput.value.trim();
    if (apiKey) {
      await this.saveProfile({ apiKey });
    }
  }


  async testApiConnection() {
    const apiKey = this.apiKeyInput.value.trim();
    if (!apiKey) {
      this.showError('Please enter an API key first');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      this.showError('API key should start with "sk-"');
      return;
    }

    this.testApiBtn.disabled = true;
    this.testApiBtn.textContent = '🔄 Testing...';

    try {
      const isValid = await this.sendMessage('test-api-key', { apiKey });
      if (isValid) {
        this.showSuccess('✅ API key is valid!');
      } else {
        this.showError('❌ API key is invalid or connection failed');
      }
    } catch (error) {
      this.showError(`❌ Test failed: ${error.message}`);
    } finally {
      this.testApiBtn.disabled = false;
      this.testApiBtn.textContent = '🔗 Test Connection';
    }
  }

  sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36);
      
      const handleResponse = (event) => {
        const response = event.data.pluginMessage;
        if (response && response.id === messageId) {
          window.removeEventListener('message', handleResponse);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        }
      };
      
      window.addEventListener('message', handleResponse);
      
      parent.postMessage({
        pluginMessage: {
          id: messageId,
          type,
          data
        }
      }, '*');
      
      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        reject(new Error('Request timeout'));
      }, 30000);
    });
  }

  handleMessage(message) {
    if (!message) return;
    
    switch (message.type) {
      case 'spec-loaded':
        this.currentSpec = message.data;
        this.renderFocusList(message.data.items);
        this.updateStats(message.data);
        this.enableActions(true);
        break;
        
      case 'error':
        this.showError(message.data);
        this.setLoading(false);
        break;
    }
  }
}

// Initialize the UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new A11yAnnotatorUI();
});