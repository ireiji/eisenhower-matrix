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
        
        const textSpan = document.createElement('span');
        textSpan.setAttribute('data-id', task.id);
        textSpan.textContent = task.text;
        taskElement.appendChild(textSpan);
        
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

renderTasks();