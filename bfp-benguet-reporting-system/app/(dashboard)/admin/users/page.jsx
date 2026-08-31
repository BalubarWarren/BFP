'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Pencil, Power } from 'lucide-react';
import SessionExpiredBanner from '@/components/common/SessionExpiredBanner';
import { useToast } from '@/components/common/ToastProvider';
import { isAuthError } from '@/lib/utils';

const ROLE_OPTIONS = [
  { value: 'INVESTIGATOR', label: 'Investigator' },
  { value: 'MUNICIPAL_CHIEF_IIS', label: 'Municipal Chief IIS' },
  { value: 'MUNICIPAL_CHIEF_OPERATION', label: 'Municipal Chief Operation' },
  { value: 'MUNICIPAL_FIRE_MARSHAL', label: 'Municipal Fire Marshal' },
  { value: 'PROVINCIAL_CHIEF_IIS', label: 'Provincial Chief IIS' },
  { value: 'MARSHAL', label: 'Marshal (Legacy Provincial)' },
  { value: 'CHIEF_INVESTIGATOR_IIS', label: 'Chief Investigator IIS (Legacy)' },
  { value: 'PROVINCIAL_CHIEF_INVESTIGATOR', label: 'Provincial Chief Investigator' },
  { value: 'REGION_IIS', label: 'Region IIS' },
  { value: 'REGIONAL_CHIEF_OPERATION', label: 'Regional Chief Operation' },
  { value: 'PIO', label: 'Public Information Officer' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

const ROLE_LABELS = ROLE_OPTIONS.reduce((acc, r) => ({ ...acc, [r.value]: r.label }), {});

const MUNICIPAL_ROLES = ['INVESTIGATOR', 'MUNICIPAL_CHIEF_IIS', 'MUNICIPAL_CHIEF_OPERATION', 'MUNICIPAL_FIRE_MARSHAL'];

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'INVESTIGATOR',
  rank: '',
  municipalityId: '',
};

export default function UserManagementPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const authHeaders = () => ({
    Authorization: `Bearer ${sessionStorage.getItem('token')}`,
  });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [usersRes, munRes] = await Promise.all([
        axios.get('/api/users', { headers: authHeaders() }),
        axios.get('/api/municipalities', { headers: authHeaders() }),
      ]);
      setUsers(usersRes.data.users || []);
      setMunicipalities(munRes.data.municipalities || []);
    } catch (err) {
      if (isAuthError(err)) {
        setSessionExpired(true);
        return;
      }
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (MUNICIPAL_ROLES.includes(formData.role) && !formData.municipalityId) {
      setCreateError('Please select a municipality for this role.');
      return;
    }

    setCreating(true);
    try {
      await axios.post(
        '/api/users',
        {
          ...formData,
          municipalityId: formData.municipalityId || null,
        },
        { headers: authHeaders() }
      );
      toast.success(`Account created for ${formData.name}.`);
      setFormData(emptyForm);
      fetchAll();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create account.');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      rank: user.rank || '',
      municipalityId: user.municipalityId || '',
      password: '',
    });
    setEditError('');
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditForm(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');

    if (MUNICIPAL_ROLES.includes(editForm.role) && !editForm.municipalityId) {
      setEditError('Please select a municipality for this role.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        role: editForm.role,
        rank: editForm.rank,
        municipalityId: editForm.municipalityId || null,
      };
      if (editForm.password) payload.password = editForm.password;

      await axios.patch(`/api/users/${editingUser.id}`, payload, { headers: authHeaders() });
      toast.success('Account updated.');
      closeEdit();
      fetchAll();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update account.');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleActive = async (user) => {
    try {
      await axios.patch(
        `/api/users/${user.id}`,
        { isActive: !user.isActive },
        { headers: authHeaders() }
      );
      toast.success(user.isActive ? `${user.name} deactivated.` : `${user.name} reactivated.`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update account status.');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (filterRole && u.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  if (sessionExpired) {
    return (
      <div className="p-8">
        <SessionExpiredBanner />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-bfp-red">System Administrator</p>
        <h1 className="text-3xl font-bold text-bfp-navy">User Management</h1>
        <p className="text-gray-500 mt-1">Create accounts and assign roles for investigators, reviewers, and staff.</p>
      </div>

      {/* Create account */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-bfp-navy mb-4">
          <UserPlus className="w-5 h-5" /> Create Account
        </h2>

        {createError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">{createError}</div>
        )}

        <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Full Name <span className="text-bfp-red">*</span></label>
            <input type="text" name="name" value={formData.name} onChange={handleCreateChange} className="form-input" required />
          </div>
          <div>
            <label className="form-label">Email <span className="text-bfp-red">*</span></label>
            <input type="email" name="email" value={formData.email} onChange={handleCreateChange} className="form-input" required />
          </div>
          <div>
            <label className="form-label">Temporary Password <span className="text-bfp-red">*</span></label>
            <input type="text" name="password" value={formData.password} onChange={handleCreateChange} className="form-input" placeholder="Min. 8 characters" required minLength={8} />
          </div>
          <div>
            <label className="form-label">Role <span className="text-bfp-red">*</span></label>
            <select name="role" value={formData.role} onChange={handleCreateChange} className="form-input" required>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {MUNICIPAL_ROLES.includes(formData.role) && (
            <div>
              <label className="form-label">Municipality <span className="text-bfp-red">*</span></label>
              <select name="municipalityId" value={formData.municipalityId} onChange={handleCreateChange} className="form-input" required>
                <option value="">— Select —</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label">Rank</label>
            <input type="text" name="rank" value={formData.rank} onChange={handleCreateChange} className="form-input" placeholder="e.g. Fire Officer III" />
          </div>
          <div className="md:col-span-3">
            <button type="submit" disabled={creating} className="btn btn-primary px-8">
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-bfp-navy">Accounts ({filteredUsers.length})</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              className="form-input"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="">All Roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading accounts…</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No accounts match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Municipality</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">{u.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{ROLE_LABELS[u.role] || u.role}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{u.municipality?.name || '—'}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => openEdit(u)} className="flex items-center gap-1 text-bfp-navy font-semibold hover:underline">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          className={`flex items-center gap-1 font-semibold hover:underline ${u.isActive ? 'text-red-600' : 'text-green-600'}`}
                        >
                          <Power className="w-3.5 h-3.5" /> {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingUser && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={closeEdit}>
          <div className="w-full max-w-md rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-bfp-red">Edit Account</p>
                <h2 className="text-xl font-bold text-bfp-navy">{editingUser.name}</h2>
              </div>
              <button onClick={closeEdit} className="text-2xl text-gray-400 hover:text-gray-600">&times;</button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 p-6">
              {editError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">{editError}</div>
              )}

              <div>
                <label className="form-label">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="form-input"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {MUNICIPAL_ROLES.includes(editForm.role) && (
                <div>
                  <label className="form-label">Municipality</label>
                  <select
                    value={editForm.municipalityId}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, municipalityId: e.target.value }))}
                    className="form-input"
                  >
                    <option value="">— Select —</option>
                    {municipalities.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">Rank</label>
                <input
                  type="text"
                  value={editForm.rank}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, rank: e.target.value }))}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Reset Password</label>
                <input
                  type="text"
                  value={editForm.password}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="form-input"
                  placeholder="Leave blank to keep current password"
                  minLength={8}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingEdit} className="btn btn-primary px-6">
                  {savingEdit ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={closeEdit} className="btn btn-secondary px-6">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
