// Initialize the tasks and load from cookies if available
let tasks = loadTasks();

// Add these variables at the top of the file
let draggedTask = null;
let dragStartX = 0;
let dragStartY = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let velocityX = 0;
let velocityY = 0;
let animationFrameId = null;
let contextMenu = null;
let editMenu = null;
let lastDueCheck = null;

function addTask() {
  const taskInput = document.getElementById('task-input');
  const taskText = taskInput.value.trim();
  if (!taskText) return;

  const newTask = { id: Date.now(), text: taskText, quadrant: 'urgent-important', done: false };
  tasks.push(newTask);
  saveTasks();
  taskInput.value = '';
  renderTasks();
}

function renderTasks() {
  const quadrants = ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'];
  quadrants.forEach(quadrant => {
    const taskList = document.getElementById(`${quadrant}-tasks`);
    const existingTasks = Array.from(taskList.children);
    
    // Store current positions of existing tasks
    const oldPositions = new Map();
    existingTasks.forEach(task => {
      const rect = task.getBoundingClientRect();
      oldPositions.set(task.querySelector('span').dataset.id, rect.top);
    });
    
    // Clear the list
    taskList.innerHTML = '';
    
    // Render new tasks
    tasks
      .filter(task => task.quadrant === quadrant)
      .forEach((task, index) => {
        const taskElement = document.createElement('div');
        taskElement.className = `task${task.done ? ' done' : ''}`;
        
        // Add due date classes if needed
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const now = new Date();
          const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
          
          if (hoursUntilDue < 0) {
            taskElement.classList.add('overdue');
          } else if (hoursUntilDue < 24) {
            taskElement.classList.add('due-soon');
          }
        }
        
        const textSpan = document.createElement('span');
        textSpan.setAttribute('data-id', task.id);
        textSpan.textContent = task.text;
        taskElement.appendChild(textSpan);
        
        // Add due date display if exists
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const dueDateElement = document.createElement('div');
          dueDateElement.className = 'due-date';
          dueDateElement.textContent = formatDueDate(dueDate);
          taskElement.appendChild(dueDateElement);
        }
        
        taskElement.onclick = () => toggleDone(task.id);
        taskElement.onmousedown = e => {
          if (e.button === 0) {
            onDragStart(e, task.id, taskElement);
          }
        };
        taskElement.oncontextmenu = e => {
          e.preventDefault();
          showContextMenu(e, task);
        };
        
        taskList.appendChild(taskElement);
        
        // Apply animations
        const oldPos = oldPositions.get(task.id);
        if (oldPos) {
          const newPos = taskElement.getBoundingClientRect().top;
          const delta = oldPos - newPos;
          if (delta !== 0) {
            requestAnimationFrame(() => {
              taskElement.style.transform = `translateY(${delta}px)`;
              taskElement.style.opacity = '1';
              
              requestAnimationFrame(() => {
                taskElement.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
                taskElement.style.transform = 'translateY(0)';
              });
            });
          }
        } else {
          // New task animation
          taskElement.style.opacity = '0';
          taskElement.style.transform = 'translateY(20px)';
          setTimeout(() => {
            taskElement.style.opacity = '1';
            taskElement.style.transform = 'translateY(0)';
          }, 50);
        }
      });
  });
}

function deleteTask(taskId) {
  const taskElement = document.querySelector(`.task:has(span[data-id="${taskId}"])`);
  if (taskElement) {
    // Store positions of tasks below the deleted task
    const quadrant = taskElement.closest('.quadrant');
    const tasksBelow = Array.from(quadrant.querySelectorAll('.task'))
      .filter(t => t.getBoundingClientRect().top > taskElement.getBoundingClientRect().top);
    
    const positions = new Map();
    tasksBelow.forEach(task => {
      const rect = task.getBoundingClientRect();
      positions.set(task.querySelector('span').dataset.id, rect.top);
    });
    
    // Add removing animation
    taskElement.style.opacity = '0';
    taskElement.style.transform = 'translateX(50px)';
    
    setTimeout(() => {
      tasks = tasks.filter(task => task.id !== taskId);
      saveTasks();
      renderTasks();
      
      // Apply animations to tasks below
      tasksBelow.forEach(task => {
        const id = task.querySelector('span').dataset.id;
        const oldPos = positions.get(id);
        const newPos = task.getBoundingClientRect().top;
        const delta = oldPos - newPos;
        
        if (delta !== 0) {
          task.style.transition = 'none';
          task.style.transform = `translateY(${delta}px)`;
          
          requestAnimationFrame(() => {
            task.style.transition = 'transform 0.3s ease';
            task.style.transform = 'translateY(0)';
          });
        }
      });
    }, 300);
  }
}

function onDragStart(event, taskId, element) {

  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
  
  event.preventDefault();
  
  const rect = element.getBoundingClientRect();
  
  // Create clone for dragging
  const clone = element.cloneNode(true);
  clone.classList.add('dragging');
  clone.style.position = 'fixed';
  clone.style.width = '200px';
  clone.style.margin = '0';
  clone.style.transition = 'none'; // Remove transition during drag
  
  // Center the clone on cursor
  clone.style.left = `${event.clientX - 100}px`; // 100 is half of width (200px)
  clone.style.top = `${event.clientY - rect.height / 2}px`;
  
  // Hide original
  element.style.opacity = '0';
  
  document.body.appendChild(clone);
  draggedTask = clone;
  
  // Set up drag parameters
  dragStartX = 100; // Half of the fixed width (200px)
  dragStartY = rect.height / 2;
  
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  
  animationFrameId = requestAnimationFrame(updateDragAnimation);
}

function onMouseMove(event) {
  if (!draggedTask) return;
  updateDraggedPosition(event);
}

function updateDraggedPosition(event) {
  if (!draggedTask) return;
  
  velocityX = (event.clientX - lastMouseX) * 0.3;
  velocityY = (event.clientY - lastMouseY) * 0.3;
  
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  
  const rotation = Math.max(-15, Math.min(15, velocityX));
  
  // Update position with centered offset
  draggedTask.style.left = `${event.clientX - dragStartX}px`;
  draggedTask.style.top = `${event.clientY - dragStartY}px`;
  draggedTask.style.transform = `rotate(${rotation}deg)`;

  requestAnimationFrame(() => {
    if (!isInsideAnyQuadrant(event.clientX, event.clientY)) {
      document.body.classList.add('delete-zone');
    } else {
      document.body.classList.remove('delete-zone');
    }
  });
}

function updateDragAnimation() {
  if (!draggedTask) return;
  
  velocityX *= 0.95;
  velocityY *= 0.95;
  
  animationFrameId = requestAnimationFrame(updateDragAnimation);
}

function onMouseUp(event) {
  if (!draggedTask) return;
  
  const quadrant = findQuadrantAtPoint(event.clientX, event.clientY);
  const originalTask = document.querySelector(`.task[style*="opacity: 0"]`);
  
  if (!quadrant) {
    // Delete task if dropped outside
    const taskId = originalTask.querySelector('span').dataset.id;
    const task = tasks.find(t => t.id == taskId);
    if (task) {
      deleteTask(task.id);
    }
  } else {
    const taskId = originalTask.querySelector('span').dataset.id;
    const task = tasks.find(t => t.id == taskId);
    if (task) {
      task.quadrant = quadrant.id;
      saveTasks();
    }
  }
  
  // Clean up
  draggedTask.remove();
  draggedTask = null;
  
  cancelAnimationFrame(animationFrameId);
  document.body.classList.remove('delete-zone');
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  
  renderTasks();
}

function findQuadrantAtPoint(x, y) {
  const quadrants = document.querySelectorAll('.quadrant');
  return Array.from(quadrants).find(quadrant => {
    const rect = quadrant.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
}

function toggleDone(taskId) {
  const task = tasks.find(t => t.id == taskId);
  if (task) {
    task.done = !task.done;
    saveTasks();
    renderTasks();
  }
}

function saveTasks() {
  document.cookie = `tasks=${JSON.stringify(tasks)}; path=/`;
}

function loadTasks() {
  const cookies = document.cookie.split('; ');
  const tasksCookie = cookies.find(row => row.startsWith('tasks='));
  if (tasksCookie) {
    const taskData = tasksCookie.split('=')[1];
    return JSON.parse(taskData);
  }
  return [];
}

function showContextMenu(event, task) {
  event.preventDefault();
  
  if (contextMenu) {
    contextMenu.remove();
  }

  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  
  const menuItems = [
    { icon: '✓', text: 'Mark as Done', action: () => toggleDone(task.id) },
    { icon: '✎', text: 'Edit Task', action: () => {
      contextMenu.remove();
      editTask(task);
    }},
    { icon: '🗑', text: 'Delete Task', action: () => deleteTask(task.id) }
  ];

  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';
    menuItem.innerHTML = `<i>${item.icon}</i>${item.text}`;
    menuItem.onclick = () => {
      // Add fade out animation before removing
      contextMenu.style.animation = 'contextMenuSlide 0.2s ease reverse';
      setTimeout(() => {
        item.action();
        contextMenu.remove();
      }, 150);
    };
    contextMenu.appendChild(menuItem);
  });

  // Position the menu
  document.body.appendChild(contextMenu);
  const rect = contextMenu.getBoundingClientRect();
  
  // Adjust position to keep menu in viewport
  let x = event.clientX;
  let y = event.clientY;
  
  if (x + rect.width > window.innerWidth) {
    x = window.innerWidth - rect.width - 5;
  }
  
  if (y + rect.height > window.innerHeight) {
    y = window.innerHeight - rect.height - 5;
  }
  
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  // Close context menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!contextMenu.contains(e.target)) {
        contextMenu.style.animation = 'contextMenuSlide 0.2s ease reverse';
        setTimeout(() => {
          contextMenu.remove();
          document.removeEventListener('click', closeMenu);
        }, 150);
      }
    });
  }, 0);
}

function editTask(task) {
  if (editMenu) {
    editMenu.remove();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'edit-overlay';
  document.body.appendChild(overlay);
  
  // Activate overlay with slight delay for smooth transition
  setTimeout(() => overlay.classList.add('active'), 0);

  editMenu = document.createElement('div');
  editMenu.className = 'edit-menu';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.text;
  input.placeholder = 'Type your task here...';

  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'buttons';

  const saveButton = document.createElement('button');
  saveButton.className = 'save';
  saveButton.innerText = 'Save Changes';
  saveButton.onclick = () => {
    const newText = input.value.trim();
    if (newText) {
      task.text = newText;
      saveTasks();
      renderTasks();
    }
    closeEditMenu();
  };

  const cancelButton = document.createElement('button');
  cancelButton.className = 'cancel';
  cancelButton.innerText = 'Cancel';
  cancelButton.onclick = closeEditMenu;

  function closeEditMenu() {
    overlay.classList.remove('active');
    setTimeout(() => {
      editMenu.remove();
      overlay.remove();
    }, 200);
  }

  buttonsDiv.appendChild(cancelButton);
  buttonsDiv.appendChild(saveButton);
  editMenu.appendChild(input);
  editMenu.appendChild(buttonsDiv);

  document.body.appendChild(editMenu);
  const rect = editMenu.getBoundingClientRect();
  editMenu.style.left = `${(window.innerWidth - rect.width) / 2}px`;
  editMenu.style.top = `${(window.innerHeight - rect.height) / 2}px`;

  input.focus();
  input.select();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeEditMenu();
    }
  });

  input.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      saveButton.click();
    } else if (e.key === 'Escape') {
      cancelButton.click();
    }
  });
}

function isInsideAnyQuadrant(x, y) {
  return !!findQuadrantAtPoint(x, y);
}

function exportMatrix() {
  const exportData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    tasks: tasks
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  // Create download link
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `eisenhower-matrix-${new Date().toISOString().split('T')[0]}.json`;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

function importMatrix(file) {
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      
      // Validate imported data
      if (!importedData.tasks || !Array.isArray(importedData.tasks)) {
        throw new Error('Invalid file format');
      }
      
      // Replace current tasks with imported ones
      tasks = importedData.tasks;
      saveTasks();
      renderTasks();
      
      // Show success message
      showNotification('Matrix imported successfully!', 'success');
      
    } catch (error) {
      showNotification('Error importing matrix: Invalid file format', 'error');
    }
  };
  
  reader.onerror = function() {
    showNotification('Error reading file', 'error');
  };
  
  reader.readAsText(file);
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Update this part to include 'Warning' for warning type
  const title = {
    'success': 'Success',
    'error': 'Error',
    'warning': 'Warning'
  }[type] || 'Notification';

  notification.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: flex-start; flex: 1;">
      <div style="font-weight: 600; margin-bottom: 2px;">${title}</div>
      <div style="font-size: 13px; opacity: 0.8;">${message}</div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Trigger animation
  requestAnimationFrame(() => {
    notification.style.transform = 'translateX(-50%) translateY(0)';
    notification.style.opacity = '1';
  });
  
  // Remove after delay
  setTimeout(() => {
    notification.style.transform = 'translateX(-50%) translateY(-20px)';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function formatDueDate(date) {
  const now = new Date();
  const hoursUntilDue = (date - now) / (1000 * 60 * 60);
  
  if (hoursUntilDue < 0) {
    return `Overdue: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  } else if (hoursUntilDue < 24) {
    return `Due today at ${date.toLocaleTimeString()}`;
  } else if (hoursUntilDue < 48) {
    return `Due tomorrow at ${date.toLocaleTimeString()}`;
  } else {
    return `Due ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }
}

function checkDueDates() {
  const now = new Date();
  
  // Don't check more than once per minute
  if (lastDueCheck && (now - lastDueCheck) < 60000) return;
  
  lastDueCheck = now;
  
  const dueTasks = tasks.filter(task => {
    if (!task.dueDate || task.done) return false;
    
    const dueDate = new Date(task.dueDate);
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
    
    return hoursUntilDue >= 0 && hoursUntilDue <= 24;
  });
  
  if (dueTasks.length > 0) {
    const message = dueTasks.length === 1
      ? `Task "${dueTasks[0].text}" is due in ${formatTimeUntil(new Date(dueTasks[0].dueDate))}`
      : `${dueTasks.length} tasks are due in the next 24 hours`;
      
    showNotification(message, 'warning');
  }
}

function formatTimeUntil(date) {
  const now = new Date();
  const hoursUntilDue = (date - now) / (1000 * 60 * 60);
  
  if (hoursUntilDue < 1) {
    const minutesUntilDue = hoursUntilDue * 60;
    return `${Math.round(minutesUntilDue)} minutes`;
  } else {
    return `${Math.round(hoursUntilDue)} hours`;
  }
}

// Add this function to check initial due dates
function checkInitialDueDates() {
  const now = new Date();
  
  const notificationIntervals = [
    { minutes: 60 * 24, message: '24 hours' },
    { minutes: 60, message: '1 hour' },
    { minutes: 30, message: '30 minutes' },
    { minutes: 15, message: '15 minutes' },
    { minutes: 5, message: '5 minutes' }
  ];
  
  tasks.forEach(task => {
    if (!task.dueDate || task.done) return;
    
    const dueDate = new Date(task.dueDate);
    const minutesUntilDue = (dueDate - now) / (1000 * 60);
    
    // Check for overdue tasks
    if (minutesUntilDue < 0) {
      showNotification(`Task "${task.text}" is overdue!`, 'error');
      return;
    }
    
    // Find the closest upcoming notification interval
    const nextInterval = notificationIntervals.find(interval => 
      minutesUntilDue <= interval.minutes
    );
    
    if (nextInterval) {
      showNotification(
        `Task "${task.text}" is due in ${nextInterval.message}`, 
        'warning'
      );
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const addButton = document.querySelector('.add-button');
  const popup = document.querySelector('.add-task-popup');
  const input = popup.querySelector('.popup-input');
  const dateInput = popup.querySelector('.date-input');
  const timeInput = popup.querySelector('.time-input');
  const cancelBtn = popup.querySelector('.cancel');
  const confirmBtn = popup.querySelector('.confirm');

  function showPopup() {
    popup.classList.add('active');
    input.focus();
  }

  function hidePopup() {
    popup.classList.remove('active');
    input.value = '';
    dateInput.value = '';
    timeInput.value = '';
  }

  function addNewTask() {
    const taskText = input.value.trim();
    if (!taskText) return;

    const dueDate = dateInput.value && timeInput.value ? 
      new Date(`${dateInput.value}T${timeInput.value}`) : null;

    const newTask = {
      id: Date.now(),
      text: taskText,
      quadrant: 'urgent-important',
      done: false,
      dueDate: dueDate ? dueDate.toISOString() : null
    };

    tasks.push(newTask);
    saveTasks();
    renderTasks();
    hidePopup();

    // Check due dates after adding
    checkDueDates();
  }

  // Handle Enter key in input
  input.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      addNewTask();
    } else if (e.key === 'Escape') {
      hidePopup();
    }
  });

  addButton.onclick = showPopup;
  cancelBtn.onclick = hidePopup;
  confirmBtn.onclick = addNewTask;

  // Import/Export handlers
  const exportBtn = document.querySelector('.matrix-button.export');
  const importBtn = document.querySelector('.matrix-button.import');
  const importFile = document.getElementById('import-file');

  if (exportBtn) {
    exportBtn.addEventListener('click', exportMatrix);
  }

  if (importBtn) {
    importBtn.addEventListener('click', () => {
      importFile.click();
    });
  }

  if (importFile) {
    importFile.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        importMatrix(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  // Load tasks first
  tasks = loadTasks();
  
  // Then check due dates immediately
  setTimeout(() => {
    checkInitialDueDates();
    // Start regular checks
    setInterval(checkDueDates, 30000);
  }, 1000);
});

// Add these helper functions if they're not already present
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function loadTasks() {
  const savedTasks = localStorage.getItem('tasks');
  return savedTasks ? JSON.parse(savedTasks) : [];
}

renderTasks();