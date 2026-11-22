// Browser equivalent of HydraGame.showKeyboardEntry. The game receives its
// original native callback and remains responsible for server validation.
Module.onMsmKeyboardEntry = request => {
  request = {...request, id:Number(request.id), minLength:Number(request.minLength)|0, maxLength:Number(request.maxLength)|0};
  const dialog = document.createElement('dialog');
  dialog.id = 'msm-keyboard';
  dialog.style.cssText = 'color:white;background:#15251f;border:1px solid #779d87;border-radius:14px;padding:24px;width:min(420px,90vw);font:16px system-ui';
  const form = document.createElement('form'); form.method = 'dialog';
  const label = document.createElement('label'); label.textContent = request.title || 'Enter text';
  const input = document.createElement('input'); input.value = request.value;
  input.style.cssText = 'display:block;width:100%;margin:16px 0;padding:10px;font:inherit';
  input.minLength = Math.max(0, request.minLength);
  input.maxLength = request.maxLength > 0 ? request.maxLength : 4096;
  input.required = input.minLength > 0; input.autocomplete = 'off';
  label.append(input); form.append(label);
  let finished = false;
  function finish(cancelled) {
    if (finished) return;
    finished = true;
    (Module.arcMsmKeyboardResults ||= {})[request.id] = input.value;
    Module._arc_msm_keyboard_complete(request.id, cancelled ? 1 : 0);
    dialog.close(); dialog.remove(); document.querySelector('#canvas').focus();
  }
  const save = document.createElement('button'); save.textContent = 'OK'; save.type = 'submit';
  save.style.cssText = 'padding:9px 24px;font:inherit'; form.append(save);
  if (request.allowCancel) {
    const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.type = 'button';
    cancel.style.cssText = 'padding:9px 20px;margin-left:10px;font:inherit'; cancel.onclick = () => finish(true); form.append(cancel);
  }
  form.onsubmit = event => {
    event.preventDefault();
    if ([...input.value].length < input.minLength) { input.setCustomValidity('Enter at least '+input.minLength+' characters.'); input.reportValidity(); return; }
    finish(false);
  };
  input.oninput = () => input.setCustomValidity('');
  dialog.oncancel = event => { event.preventDefault(); if (request.allowCancel) finish(true); };
  dialog.append(form); document.body.append(dialog); dialog.showModal(); input.focus(); input.select();
};
