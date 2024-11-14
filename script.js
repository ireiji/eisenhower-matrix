// Initialize the tasks and load from cookies if available
let tasks = loadTasks();

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
    taskList.innerHTML = '';
    tasks
      .filter(task => task.quadrant === quadrant)
      .forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = `task${task.done ? ' done' : ''}`;
        taskElement.draggable = true;
        taskElement.innerText = task.text;
        taskElement.onclick = () => toggleDone(task.id);
        taskElement.ondragstart = e => onDragStart(e, task.id);

        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.innerText = '✖';
        deleteButton.className = 'delete-btn';
        deleteButton.onclick = (e) => {
          e.stopPropagation(); // Prevent marking task as done
          deleteTask(task.id);
        };

        taskElement.appendChild(deleteButton); // Add delete button to task
        taskList.appendChild(taskElement);
      });
  });
}

function deleteTask(taskId) {
  tasks = tasks.filter(task => task.id !== taskId);
  saveTasks();
  renderTasks();
}

function onDragStart(event, taskId) {
  event.dataTransfer.setData('task-id', taskId);
}

function onDrop(event, quadrant) {
  event.preventDefault();
  const taskId = event.dataTransfer.getData('task-id');
  const task = tasks.find(t => t.id == taskId);
  if (task) {
    task.quadrant = quadrant;
    saveTasks();
    renderTasks();
  }
}

function allowDrop(event) {
  event.preventDefault();
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

// Setup event listeners for drag-and-drop
document.querySelectorAll('.quadrant').forEach(quadrant => {
  quadrant.ondrop = event => onDrop(event, quadrant.id);
  quadrant.ondragover = allowDrop;
});

renderTasks();
