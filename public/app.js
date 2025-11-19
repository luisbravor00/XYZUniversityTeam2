// app.js - minimal client to call the Node API
document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('students-body');
  const modal = document.getElementById('modal');
  const form = document.getElementById('student-form');
  const title = document.getElementById('modal-title');
  const btnAdd = document.getElementById('btn-add');
  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const importFile = document.getElementById('import-file');
  const searchInput = document.getElementById('search');
  const cancel = document.getElementById('cancel');
  const formErrors = document.getElementById('form-errors');

  let studentsCache = [];

  function showModal(mode='add', student={}) {
    title.textContent = mode === 'add' ? 'Add student' : 'Edit student';
    form['student-id'].value = student.id || '';
    form['name'].value = student.name || '';
    form['address'].value = student.address || '';
    form['city'].value = student.city || '';
    form['state'].value = student.state || '';
    form['email'].value = student.email || '';
    form['phone'].value = student.phone || '';
    formErrors.innerHTML = '';
    modal.classList.remove('hidden');
  }

  function hideModal() {
    modal.classList.add('hidden');
  }

  async function loadStudents() {
    const res = await fetch('/api/students');
    studentsCache = await res.json();
    renderTable(studentsCache);
  }

  function renderTable(list) {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = list.filter(s =>
      !q || (s.name && s.name.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
    body.innerHTML = filtered.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.address)}</td>
        <td>${escapeHtml(s.city)}</td>
        <td>${escapeHtml(s.state)}</td>
        <td>${escapeHtml(s.email)}</td>
        <td>${escapeHtml(s.phone)}</td>
        <td>
          <button class="action-btn edit" data-id="${s.id}">edit</button>
          <button class="action-btn delete" data-id="${s.id}">delete</button>
        </td>
      </tr>
    `).join('');
    attachRowHandlers();
  }

  function attachRowHandlers() {
    document.querySelectorAll('.action-btn.edit').forEach(btn =>
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const stud = studentsCache.find(s => s.id === id);
        showModal('edit', stud);
      })
    );
    document.querySelectorAll('.action-btn.delete').forEach(btn =>
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!confirm('Confirm delete?')) return;
        await fetch('/api/students/' + id, { method: 'DELETE' });
        await loadStudents();
      })
    );
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const payload = {
      name: form['name'].value.trim(),
      address: form['address'].value.trim(),
      city: form['city'].value.trim(),
      state: form['state'].value.trim(),
      email: form['email'].value.trim(),
      phone: form['phone'].value.trim()
    };
    const id = form['student-id'].value;
    formErrors.innerHTML = '';
    try {
      let res;
      if (id) {
        res = await fetch('/api/students/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      if (res.status === 422) {
        const body = await res.json();
        formErrors.innerHTML = body.errors.map(e => `<div>${e.msg}</div>`).join('');
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(()=>({error:'unknown'}));
        formErrors.innerHTML = `<div>Error: ${j.error || 'server'}</div>`;
        return;
      }
      hideModal();
      await loadStudents();
    } catch (err) {
      formErrors.innerHTML = `<div>Network error</div>`;
      console.error(err);
    }
  });

  cancel.addEventListener('click', (e)=> { e.preventDefault(); hideModal(); });

  btnAdd.addEventListener('click', () => showModal('add'));

  searchInput.addEventListener('input', () => renderTable(studentsCache));

  btnExport.addEventListener('click', () => {
    window.location.href = '/api/export';
  });

  btnImport.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const arr = JSON.parse(text);
      // Bulk upload: call create for each (naive)
      for (const s of arr) {
        // minimal mapping
        await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: s.name || s.fullName || 'Unknown',
            address: s.address || '',
            city: s.city || '',
            state: s.state || '',
            email: s.email || '',
            phone: s.phone || ''
          })
        });
      }
      await loadStudents();
      alert('Import completed');
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    importFile.value = '';
  });

  // escape helper
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'
    }[c]));
  }

  // initial load
  loadStudents();
});
