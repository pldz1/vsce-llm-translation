(function () {
  const vscode = acquireVsCodeApi();

  const endpointInput = document.getElementById('endpoint-input');
  const apikeyInput = document.getElementById('apikey-input');
  const modelNameInput = document.getElementById('modelname-input');
  const targetSelect = document.getElementById('target-language-select');
  const promptTextarea = document.getElementById('prompt-textarea');
  const promptLockCheckbox = document.getElementById('lock-prompt-checkbox');
  const addModeButton = document.getElementById('add-mode-button');
  const newModeLabelInput = document.getElementById('new-mode-label-input');
  const newModePromptTextarea = document.getElementById('new-mode-prompt-textarea');
  const deleteModeButton = document.getElementById('delete-mode-button');
  const translateButton = document.getElementById('start-translate');
  const translateTextarea = document.getElementById('translate-textarea');
  const translateReplace = document.getElementById('replace-text-checkbox');
  const resultSpan = document.getElementById('res-span');
  const notification = document.getElementById('notification');

  if (!endpointInput || !apikeyInput || !modelNameInput || !targetSelect ||
      !promptTextarea || !promptLockCheckbox || !addModeButton || !newModeLabelInput ||
      !newModePromptTextarea || !deleteModeButton || !translateButton ||
      !translateTextarea || !translateReplace || !resultSpan || !notification) {
    console.error('部分必要的 DOM 元素不存在');
    return;
  }

  let promptConfigs = {};
  let promptOrder = [];
  let currentTarget = '';
  let promptSaveTimer = null;
  let notificationTimer = null;

  // ── 通知 ──────────────────────────────────────────────────────────────────

  function hideNotification() {
    notification.classList.add('notification--hidden');
    notificationTimer = null;
  }

  function showNotification(message, type = 'info') {
    if (notificationTimer) { clearTimeout(notificationTimer); }
    notification.textContent = message;
    notification.className = `notification notification--${type}`;
    notificationTimer = setTimeout(hideNotification, 3000);
  }

  // ── 下拉选项渲染 ──────────────────────────────────────────────────────────

  function renderTargetOptions(selectedValue) {
    const fragment = document.createDocumentFragment();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '请选择';
    fragment.appendChild(placeholder);
    promptOrder.forEach((id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = promptConfigs[id] ? promptConfigs[id].label : id;
      fragment.appendChild(opt);
    });
    targetSelect.innerHTML = '';
    targetSelect.appendChild(fragment);
    if (selectedValue && promptConfigs[selectedValue]) {
      targetSelect.value = selectedValue;
    }
  }

  function updatePromptArea(targetId) {
    promptTextarea.value = (targetId && promptConfigs[targetId]) ? (promptConfigs[targetId].prompt || '') : '';
    updateDeleteButtonState(targetId);
  }

  function updateDeleteButtonState(targetId) {
    if (!targetId || !promptConfigs[targetId]) {
      deleteModeButton.disabled = true;
      return;
    }
    deleteModeButton.disabled = !promptConfigs[targetId].canDelete;
  }

  // ── 提示词持久化 ──────────────────────────────────────────────────────────

  function persistPrompts() {
    vscode.postMessage({ type: 'savePrompts', prompts: promptConfigs, promptOrder });
  }

  function schedulePromptSave(immediate = false) {
    if (!currentTarget || !promptConfigs[currentTarget]) { return; }
    if (promptSaveTimer) { clearTimeout(promptSaveTimer); promptSaveTimer = null; }
    const save = () => {
      promptConfigs[currentTarget].prompt = promptTextarea.value;
      persistPrompts();
    };
    if (immediate) { save(); }
    else { promptSaveTimer = setTimeout(save, 400); }
  }

  function generateAlphaNumericId() {
    return `${Date.now().toString(36)}-${Math.random().toString(16).substring(2, 6)}`;
  }

  // ── 接收来自扩展的消息 ─────────────────────────────────────────────────────

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'configLoaded': {
        const { endpoint, apiKey, modelName, target, replaceText, prompts, promptOrder: order } = msg.data;
        promptConfigs = prompts || {};
        promptOrder = order || [];
        if (endpoint) { endpointInput.value = endpoint; }
        if (apiKey) { apikeyInput.value = apiKey; }
        if (modelName) { modelNameInput.value = modelName; }
        currentTarget = (target && promptConfigs[target]) ? target : '';
        renderTargetOptions(currentTarget);
        if (target) { targetSelect.value = target; }
        translateReplace.checked = !!replaceText;
        updatePromptArea(currentTarget);
        promptTextarea.disabled = promptLockCheckbox.checked;
        break;
      }
      case 'translationStart':
        translateButton.textContent = '...';
        translateButton.disabled = true;
        resultSpan.textContent = '';
        break;
      case 'translationResult':
        resultSpan.textContent = msg.result;
        translateButton.textContent = '执行';
        translateButton.disabled = false;
        break;
      case 'translationError':
        showNotification(msg.message, 'error');
        translateButton.textContent = '执行';
        translateButton.disabled = false;
        break;
    }
  });

  // ── 配置字段事件 ───────────────────────────────────────────────────────────

  endpointInput.addEventListener('change', function () {
    vscode.postMessage({ type: 'saveEndpoint', value: endpointInput.value });
  });

  apikeyInput.addEventListener('change', function () {
    vscode.postMessage({ type: 'saveApiKey', value: apikeyInput.value });
  });

  modelNameInput.addEventListener('change', function () {
    vscode.postMessage({ type: 'saveModelName', value: modelNameInput.value });
  });

  targetSelect.addEventListener('change', function () {
    const target = targetSelect.value;
    currentTarget = (target && promptConfigs[target]) ? target : '';
    vscode.postMessage({ type: 'saveTarget', value: target });
    updatePromptArea(currentTarget);
  });

  translateReplace.addEventListener('change', function () {
    vscode.postMessage({ type: 'saveReplaceText', value: translateReplace.checked });
  });

  // ── 提示词编辑事件 ─────────────────────────────────────────────────────────

  promptLockCheckbox.addEventListener('change', function () {
    promptTextarea.disabled = promptLockCheckbox.checked;
    if (!promptLockCheckbox.checked) {
      promptTextarea.focus();
    } else {
      schedulePromptSave(true);
    }
  });

  promptTextarea.addEventListener('input', function () {
    if (!currentTarget || promptLockCheckbox.checked) {
      showNotification('请选择有效的模式!', 'error');
      return;
    }
    if (!promptConfigs[currentTarget]) {
      showNotification('模式数据无效，请删除这个模式!', 'error');
      return;
    }
    promptConfigs[currentTarget].prompt = promptTextarea.value;
    schedulePromptSave(false);
  });

  promptTextarea.addEventListener('blur', function () {
    if (!currentTarget || promptLockCheckbox.checked) { return; }
    schedulePromptSave(true);
  });

  // ── 新增模式 ──────────────────────────────────────────────────────────────

  addModeButton.addEventListener('click', function () {
    const label = newModeLabelInput.value.trim();
    const prompt = newModePromptTextarea.value.trim();
    if (!label || !prompt) {
      showNotification('请完整填写模式名称和提示词内容。', 'error');
      return;
    }
    const id = generateAlphaNumericId();
    promptConfigs = { ...promptConfigs, [id]: { label, id, canDelete: true, prompt } };
    promptOrder = [...promptOrder, id];
    persistPrompts();
    renderTargetOptions(id);
    currentTarget = id;
    targetSelect.value = id;
    vscode.postMessage({ type: 'saveTarget', value: id });
    updatePromptArea(currentTarget);
    promptLockCheckbox.checked = false;
    promptTextarea.disabled = false;
    promptTextarea.focus();
    newModeLabelInput.value = '';
    newModePromptTextarea.value = '';
  });

  // ── 删除模式 ──────────────────────────────────────────────────────────────

  deleteModeButton.addEventListener('click', function () {
    if (!currentTarget || !promptConfigs[currentTarget] || !promptConfigs[currentTarget].canDelete) {
      return;
    }
    const removedId = currentTarget;
    const updated = { ...promptConfigs };
    delete updated[removedId];
    promptConfigs = updated;
    promptOrder = promptOrder.filter((id) => id !== removedId);
    persistPrompts();
    const nextTarget = promptOrder.length > 0 ? promptOrder[0] : '';
    currentTarget = nextTarget;
    renderTargetOptions(currentTarget);
    targetSelect.value = currentTarget;
    vscode.postMessage({ type: 'saveTarget', value: currentTarget });
    updatePromptArea(currentTarget);
    promptTextarea.disabled = promptLockCheckbox.checked;
  });

  // ── 执行翻译 ──────────────────────────────────────────────────────────────

  translateButton.addEventListener('click', function () {
    schedulePromptSave(true);
    const text = translateTextarea.value.trim();
    if (!text) {
      showNotification('请输入要翻译的文本', 'error');
      return;
    }
    vscode.postMessage({ type: 'translate', text });
  });

  // ── 初始化：请求配置 ───────────────────────────────────────────────────────

  vscode.postMessage({ type: 'getConfig' });
})();
