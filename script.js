// Pomodoro + Tasks + Total time (localStorage)
// -------------------------
const clockEl = document.getElementById('clock');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

const workMinInput = document.getElementById('workMin');
const shortMinInput = document.getElementById('shortMin');
const longMinInput = document.getElementById('longMin');

const modeButtons = document.querySelectorAll('.mode');
const sessionCountEl = document.getElementById('sessionCount');
const activeTaskNameEl = document.getElementById('activeTaskName');

const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskListEl = document.getElementById('taskList');

const totalTimeDisplay = document.getElementById('totalTimeDisplay');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

let timer = null;
let remainingSeconds = 25 * 60;
let running = false;
let currentMode = 'work'; // work | short | long
let sessionsCompleted = 0;
let activeTaskId = null;

// localStorage keys
const LS_TASKS = 'sfh_tasks_v1';
const LS_TOTAL_MIN = 'sfh_total_min_v1';
const LS_HISTORY = 'sfh_history_v1';
const LS_TIMER = 'sfh_timer_v1';

// utils
const formatTime = s => {
  const m = Math.floor(s / 60).toString().padStart(2,'0');
  const sec = (s % 60).toString().padStart(2,'0');
  return `${m}:${sec}`;
};

const saveTasks = tasks => localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
const loadTasks = () => JSON.parse(localStorage.getItem(LS_TASKS) || '[]');

const saveTimerState = state => localStorage.setItem(LS_TIMER, JSON.stringify(state));
const loadTimerState = () => JSON.parse(localStorage.getItem(LS_TIMER) || 'null');

const saveTotal = min => localStorage.setItem(LS_TOTAL_MIN, String(min));
const loadTotal = () => parseInt(localStorage.getItem(LS_TOTAL_MIN) || '0', 10);

const saveHistory = arr => localStorage.setItem(LS_HISTORY, JSON.stringify(arr));
const loadHistory = () => JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');

// Task management
function renderTasks(){
  const tasks = loadTasks();
  taskListEl.innerHTML = '';
  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = task.id;

    const left = document.createElement('div');
    left.style.display = 'flex'; left.style.gap = '10px'; left.style.alignItems = 'center';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!task.done;
    checkbox.addEventListener('change', () => toggleTaskDone(task.id));

    const titleWrap = document.createElement('div');
    titleWrap.className = 'task-title';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = task.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${task.pomodoros || 0} pomodoros`;

    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);

    left.appendChild(checkbox);
    left.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const selectBtn = document.createElement('button');
    selectBtn.className = 'icon-btn';
    selectBtn.title = 'Set active task';
    selectBtn.textContent = (task.id === activeTaskId) ? 'Active' : 'Set';
    selectBtn.addEventListener('click', () => setActiveTask(task.id));

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Edit';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', () => editTask(task.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Delete';
    delBtn.textContent = '🗑';
    delBtn.addEventListener('click', () => deleteTask(task.id));

    actions.appendChild(selectBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);
    taskListEl.appendChild(li);
  });

  updateActiveTaskLabel();
}

function addTask(title){
  const tasks = loadTasks();
  const t = {
    id: 't_' + Date.now(),
    title,
    done: false,
    pomodoros: 0
  };
  tasks.unshift(t);
  saveTasks(tasks);
  renderTasks();
}

function toggleTaskDone(id){
  const tasks = loadTasks().map(t => t.id===id ? {...t, done: !t.done} : t);
  saveTasks(tasks);
  renderTasks();
}

function editTask(id){
  const tasks = loadTasks();
  const t = tasks.find(x=>x.id===id);
  const newTitle = prompt('Edit task title', t.title);
  if(newTitle !== null){
    t.title = newTitle.trim() || t.title;
    saveTasks(tasks);
    renderTasks();
  }
}

function deleteTask(id){
  let tasks = loadTasks();
  if (confirm('Delete this task?')) {
    tasks = tasks.filter(t => t.id !== id);
    if (activeTaskId === id) activeTaskId = null;
    saveTasks(tasks);
    renderTasks();
  }
}

function setActiveTask(id){
  activeTaskId = id === activeTaskId ? null : id;
  saveTimerState({remainingSeconds, running, currentMode, sessionsCompleted, activeTaskId});
  renderTasks();
}

function incrementTaskPomodoro(id){
  const tasks = loadTasks();
  const t = tasks.find(x=>x.id===id);
  if (t){
    t.pomodoros = (t.pomodoros || 0) + 1;
    saveTasks(tasks);
    renderTasks();
  }
}

// Timer functions
function setMode(mode){
  currentMode = mode;
  modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode===mode));
  let mins = parseInt(workMinInput.value,10) || 25;
  if (mode === 'short') mins = parseInt(shortMinInput.value,10) || 5;
  if (mode === 'long') mins = parseInt(longMinInput.value,10) || 15;
  remainingSeconds = mins * 60;
  updateClock();
  saveTimerState({remainingSeconds, running, currentMode, sessionsCompleted, activeTaskId});
}

function startTimer(){
  if (running) return;
  running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  timer = setInterval(() => {
    if (remainingSeconds > 0) {
      remainingSeconds--;
      updateClock();
      saveTimerState({remainingSeconds, running, currentMode, sessionsCompleted, activeTaskId});
    } else {
      // session finished
      clearInterval(timer);
      running = false;
      startBtn.disabled = false;
      pauseBtn.disabled = true;

      // record completion
      const minutes = getModeMinutes(currentMode);
      addToTotal(minutes);
      sessionsCompleted++;
      sessionCountEl.textContent = `Sessions: ${sessionsCompleted}`;

      // mark task pomodoro if active
      if (activeTaskId) {
        incrementTaskPomodoro(activeTaskId);
      }

      // add to history
      addHistoryItem({mode:currentMode, minutes, taskId: activeTaskId, taskTitle: getTaskTitle(activeTaskId), time: new Date().toISOString()});
      // Automatically switch mode: if work -> short or long; if break -> work
      if (currentMode === 'work'){
        // after 4 work sessions -> long break
        if (sessionsCompleted % 4 === 0) setMode('long'); else setMode('short');
      } else {
        setMode('work');
      }

      // auto start next session? leave stopped (user can Start)
      saveTimerState({remainingSeconds, running, currentMode, sessionsCompleted, activeTaskId});
      alert('Session finished!');
    }
  }, 1000);
}

function pauseTimer(){
  if (!running) return;
  running = false;
  clearInterval(timer);
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  saveTimerState({remainingSeconds, running, currentMode, sessionsCompleted, activeTaskId});
}

function resetTimer(){
  setMode('work');
  running = false;
  clearInterval(timer);
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  sessionsCompleted = 0;
  sessionCountEl.textContent = `Sessions: ${sessionsCompleted}`;
  saveTimerState({remainingSeconds, running, currentMode, sessionsCompleted, activeTaskId});
}

function updateClock(){ clockEl.textContent = formatTime(remainingSeconds); }

function getModeMinutes(mode){
  if (mode === 'work') return parseInt(workMinInput.value,10) || 25;
  if (mode === 'short') return parseInt(shortMinInput.value,10) || 5;
  return parseInt(longMinInput.value,10) || 15;
}

// Total study minutes
function addToTotal(mins){
  const prev = loadTotal();
  const next = prev + mins;
  saveTotal(next);
  updateTotalDisplay();
}

function updateTotalDisplay(){
  const total = loadTotal();
  totalTimeDisplay.textContent = `Total study: ${total} min`;
}

// History
function addHistoryItem(item){
  const arr = loadHistory();
  arr.unshift(item);
  while(arr.length > 50) arr.pop();
  saveHistory(arr);
  renderHistory();
}

function renderHistory(){
  const arr = loadHistory();
  historyList.innerHTML = '';
  if (arr.length === 0) historyList.textContent = 'No sessions yet.';
  arr.forEach(it => {
    const d = new Date(it.time);
    const el = document.createElement('div');
    el.className = 'history-item';
    el.textContent = `${d.toLocaleString()}: ${it.mode} — ${it.minutes}m${it.taskTitle ? ' — ' + it.taskTitle : ''}`;
    historyList.appendChild(el);
  });
}

// helpers
function getTaskTitle(id){
  const t = loadTasks().find(x=>x.id===id);
  return t ? t.title : '';
}

function updateActiveTaskLabel(){
  const title = getTaskTitle(activeTaskId);
  activeTaskNameEl.textContent = title || 'None';
  // update buttons label in task list
  taskListEl.querySelectorAll('.task-item').forEach(li => {
    const id = li.dataset.id;
    const btn = li.querySelector('.task-actions button');
    if (btn) btn.textContent = (id === activeTaskId) ? 'Active' : 'Set';
  });
}

// events hookups
modeButtons.forEach(btn => btn.addEventListener('click', () => {
  setMode(btn.dataset.mode);
}));

startBtn.addEventListener('click', () => startTimer());
pauseBtn.addEventListener('click', () => pauseTimer());
resetBtn.addEventListener('click', () => {
  if (confirm('Reset timer and sessions?')) resetTimer();
});

addTaskBtn.addEventListener('click', () => {
  const v = taskInput.value.trim();
  if (!v) return;
  addTask(v);
  taskInput.value = '';
});
taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTaskBtn.click();
});

workMinInput.addEventListener('change', () => { if (currentMode==='work') setMode('work'); });
shortMinInput.addEventListener('change', () => { if (currentMode==='short') setMode('short'); });
longMinInput.addEventListener('change', () => { if (currentMode==='long') setMode('long'); });

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear history?')) { saveHistory([]); renderHistory(); }
});

// initialize
function init(){
  // load tasks
  renderTasks();

  // restore timer state if present
  const st = loadTimerState();
  if (st){
    remainingSeconds = st.remainingSeconds || remainingSeconds;
    running = st.running || false;
    currentMode = st.currentMode || currentMode;
    sessionsCompleted = st.sessionsCompleted || sessionsCompleted;
    activeTaskId = st.activeTaskId || null;
  }
  // apply mode and UI
  setMode(currentMode);
  sessionsCompleted = sessionsCompleted || 0;
  sessionCountEl.textContent = `Sessions: ${sessionsCompleted}`;
  updateClock();
  updateTotalDisplay();
  renderHistory();

  // if timer was running, don't auto restart interval; keep stopped and user starts it
  if (running) {
    // reflect UI but do not restart automatically to avoid surprising user
    startBtn.disabled = true;
    pauseBtn.disabled = false;
  } else {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  }
}

init();
