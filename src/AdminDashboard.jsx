
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';

import {
  listDocuments,
  createDocument,
  updateDocument,
} from './firebase-api';

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Customers', icon: Users },
  { label: 'Applications', icon: FileText },
];

const statusColor = {
  Active: 'success',
  Inactive: 'default',
  Pending: 'warning',
  Approved: 'success',
  'On Hold': 'info',
  Rejected: 'error',
};

function displayStatus(status) {
  const value = String(status || 'pending').toLowerCase();

  if (value === 'active') return 'Active';
  if (value === 'inactive') return 'Inactive';
  if (value === 'approved') return 'Approved';
  if (value === 'rejected') return 'Rejected';
  if (value === 'on_hold' || value === 'on hold') return 'On Hold';

  return 'Pending';
}

function displayDate(value) {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminDashboard({
  mode = 'light',
  onToggleMode,
  onExit,
  idToken,
  adminUid,
  adminEmail,
}) {
  const [page, setPage] = useState('Overview');
  const [customers, setCustomers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [customerDialog, setCustomerDialog] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('success');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    uid: '',
    name: '',
    email: '',
    phone: '',
  });

  const dark = mode === 'dark';

  const colors = {
    navy: '#101D35',
    gold: '#D7B66D',
    background: dark ? '#0B1220' : '#F5F2EA',
    card: dark ? '#17243A' : '#FFFFFF',
    raised: dark ? '#1D2B43' : '#FAF7EF',
    ink: dark ? '#F5F2EA' : '#101D35',
    muted: dark ? '#A8B0BE' : '#777B85',
    line: dark ? '#2B3A50' : '#E8E2D6',
  };

  const showNotice = (message, type = 'success') => {
    setNotice(message);
    setNoticeType(type);
  };

  // Load real Firestore records.
  const loadData = async () => {
    if (!idToken) {
      setError('Admin authentication is missing. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [customerRecords, applicationRecords, accountRecords] =
        await Promise.all([
          listDocuments('rrb_customers', idToken),
          listDocuments('rrb_applications', idToken),
          listDocuments('rrb_accounts', idToken),
        ]);

      setCustomers(
        customerRecords.map((customer) => {
          const customerAccount = accountRecords.find(
            (account) => account.customerUid === customer.id
          );

          return {
            id: customer.id,
            customerId: customer.customerId || customer.id,
            name: customer.fullName || 'Unnamed customer',
            email: customer.email || '',
            phone: customer.phone || '',
            status: displayStatus(customer.status),
            balance: Number(customerAccount?.balancePaise || 0) / 100,
            accountNumber: customerAccount?.accountNumber || '',
          };
        })
      );

      setAccounts(accountRecords);

      setApplications(
        applicationRecords.map((application) => ({
          id: application.id,
          name: application.fullName || 'Unnamed applicant',
          email: application.email || '',
          phone: application.phone || '',
          date: displayDate(application.submittedAt),
          type: application.accountType || 'Savings Account',
          documents: application.documentReference
            ? 'Document reference available'
            : 'No document reference',
          documentReference: application.documentReference || '',
          applicantUid: application.applicantUid || '',
          status: displayStatus(application.status),
        }))
      );
    } catch (err) {
      setError(err.message || 'Unable to load bank records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [idToken]);

  const activeCount = customers.filter(
    (customer) => customer.status === 'Active'
  ).length;

  const pendingCount = applications.filter(
    (application) => application.status === 'Pending'
  ).length;

  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.balancePaise || 0) / 100,
    0
  );

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const term = search.toLowerCase();

      const matchesSearch =
        customer.name.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term) ||
        customer.customerId.toLowerCase().includes(term);

      const matchesFilter =
        filter === 'All' || customer.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [customers, search, filter]);

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setForm({
      uid: '',
      name: '',
      email: '',
      phone: '',
    });
    setCustomerDialog(true);
  };

  const openEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setForm({
      uid: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    });
    setCustomerDialog(true);
  };

  const saveCustomer = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      showNotice('Please complete all customer details.', 'error');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      showNotice('Please enter a valid email address.', 'error');
      return;
    }

    if (!/^\d{10}$/.test(form.phone)) {
      showNotice('Enter a valid 10-digit mobile number.', 'error');
      return;
    }

    if (!editingCustomer && !form.uid.trim()) {
      showNotice('Enter the existing Firebase Authentication UID.', 'error');
      return;
    }

    setSaving(true);

    try {
      const customerData = {
        fullName: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (editingCustomer) {
        await updateDocument(
          'rrb_customers',
          editingCustomer.id,
          customerData,
          idToken
        );

        showNotice('Customer profile updated in Firestore.');
      } else {
        await createDocument(
          'rrb_customers',
          {
            ...customerData,
            customerId: `CUST-${form.uid.trim().slice(0, 8)}`,
            status: 'active',
            createdAt: new Date().toISOString(),
          },
          idToken,
          form.uid.trim()
        );

        showNotice(
          'Customer profile created. The Firebase Authentication account must already exist.'
        );
      }

      setCustomerDialog(false);
      await loadData();
    } catch (err) {
      showNotice(err.message || 'Unable to save customer.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleCustomerStatus = async (customer) => {
    const nextStatus =
      customer.status === 'Active' ? 'inactive' : 'active';

    setSaving(true);

    try {
      await updateDocument(
        'rrb_customers',
        customer.id,
        {
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        },
        idToken
      );

      showNotice(
        `${customer.name} marked ${nextStatus} in Firestore.`
      );

      await loadData();
    } catch (err) {
      showNotice(err.message || 'Unable to update customer status.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateApplication = async (application, status) => {
    setSaving(true);

    try {
      await updateDocument(
        'rrb_applications',
        application.id,
        {
          status:
            status === 'On Hold'
              ? 'on_hold'
              : status.toLowerCase(),
          reviewedAt: new Date().toISOString(),
          reviewedBy: adminUid || '',
        },
        idToken
      );

      showNotice(
        `Application ${application.id} marked ${status}. The decision has been saved.`
      );

      await loadData();
    } catch (err) {
      showNotice(err.message || 'Unable to update application.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const panelSx = {
    backgroundColor: colors.card,
    border: `1px solid ${colors.line}`,
    borderRadius: 3,
    boxShadow: 'none',
  };

  const buttonSx = {
    textTransform: 'none',
    borderRadius: 2,
    fontWeight: 600,
  };

  const StatCard = ({ title, value, caption, icon: Icon }) => (
    <Paper sx={{ ...panelSx, p: 2.5, minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography sx={{ color: colors.muted, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
          {title.toUpperCase()}
        </Typography>
        <Box sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          color: colors.gold,
          backgroundColor: dark ? '#D7B66D18' : '#D7B66D22',
        }}>
          <Icon size={19} />
        </Box>
      </Stack>
      <Typography sx={{ mt: 2, fontSize: 29, fontWeight: 600, color: colors.ink, fontFamily: 'Georgia, serif' }}>
        {value}
      </Typography>
      <Typography sx={{ mt: 0.7, fontSize: 12, color: colors.muted }}>
        {caption}
      </Typography>
    </Paper>
  );

  const SectionHeading = ({ eyebrow, title, subtitle, action }) => (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={2}
      sx={{ mb: 3 }}
    >
      <Box>
        <Typography sx={{ color: colors.gold, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>
          {eyebrow}
        </Typography>
        <Typography sx={{ mt: 0.7, fontFamily: 'Georgia, serif', fontSize: 30, color: colors.ink }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: colors.muted }}>
          {subtitle}
        </Typography>
      </Box>
      {action}
    </Stack>
  );

  const renderOverview = () => (
    <>
      <SectionHeading
        eyebrow="BANK ADMINISTRATION"
        title="Good afternoon, Administrator."
        subtitle="Here is what's happening at Richie Rich Bank today."
        action={
          <Chip
            icon={<ShieldCheck size={14} />}
            label="Administrator"
            sx={{
              color: colors.gold,
              border: `1px solid ${colors.gold}70`,
              backgroundColor: `${colors.gold}12`,
              fontWeight: 700,
            }}
          />
        }
      />

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
        gap: 2,
        mb: 3,
      }}>
        <StatCard title="Total Customers" value={customers.length} caption="Firestore customer profiles" icon={Users} />
        <StatCard title="Active Customers" value={activeCount} caption="Currently active profiles" icon={CheckCircle2} />
        <StatCard title="Pending Applications" value={pendingCount} caption="Waiting for your review" icon={Clock3} />
        <StatCard title="Customer Deposits" value={money(totalBalance)} caption="Balances recorded in bank accounts" icon={Wallet} />
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' },
        gap: 2,
      }}>
        <Paper sx={{ ...panelSx, p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
            <Box>
              <Typography fontWeight={700} color={colors.ink}>Recent Customers</Typography>
              <Typography fontSize={12} color={colors.muted} mt={0.5}>Customer profiles from Firestore</Typography>
            </Box>
            <Button size="small" endIcon={<ChevronRight size={15} />} onClick={() => setPage('Customers')} sx={{ ...buttonSx, color: colors.gold }}>
              View all
            </Button>
          </Stack>

          {customers.slice(0, 4).map((customer) => (
            <Stack key={customer.id} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5, borderTop: `1px solid ${colors.line}` }}>
              <Avatar sx={{ width: 38, height: 38, bgcolor: dark ? '#293B56' : '#EDE6D7', color: colors.ink, fontSize: 13 }}>
                {customer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontSize={13} fontWeight={700} color={colors.ink}>{customer.name}</Typography>
                <Typography fontSize={11} color={colors.muted}>{customer.customerId}</Typography>
              </Box>
              <Chip size="small" label={customer.status} color={statusColor[customer.status]} variant="outlined" />
            </Stack>
          ))}

          {customers.length === 0 && (
            <Typography color={colors.muted} fontSize={13}>No customer records found.</Typography>
          )}
        </Paper>

        <Paper sx={{ ...panelSx, p: 3 }}>
          <Typography fontWeight={700} color={colors.ink}>Application Overview</Typography>
          <Typography fontSize={12} color={colors.muted} mt={0.5}>Account requests requiring attention</Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            {[
              { label: 'Pending review', count: applications.filter((a) => a.status === 'Pending').length, color: '#D7B66D' },
              { label: 'On hold', count: applications.filter((a) => a.status === 'On Hold').length, color: '#5B9BD5' },
              { label: 'Approved', count: applications.filter((a) => a.status === 'Approved').length, color: '#2B9A6A' },
              { label: 'Rejected', count: applications.filter((a) => a.status === 'Rejected').length, color: '#C75A68' },
            ].map((item) => (
              <Box key={item.label}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.7 }}>
                  <Typography fontSize={12} color={colors.muted}>{item.label}</Typography>
                  <Typography fontSize={12} fontWeight={700} color={colors.ink}>{item.count}</Typography>
                </Stack>
                <Box sx={{ height: 7, borderRadius: 10, backgroundColor: colors.raised, overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%',
                    width: `${Math.min(100, item.count / Math.max(1, applications.length) * 100)}%`,
                    backgroundColor: item.color,
                    borderRadius: 10,
                  }} />
                </Box>
              </Box>
            ))}
          </Stack>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setPage('Applications')}
            sx={{ ...buttonSx, mt: 3, borderColor: colors.line, color: colors.ink }}
          >
            Review applications
          </Button>
        </Paper>
      </Box>

      <Paper sx={{ ...panelSx, p: 3, mt: 2 }}>
        <Typography fontWeight={700} color={colors.ink}>Quick Actions</Typography>
        <Typography fontSize={12} color={colors.muted} mt={0.5}>Common administration tasks</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
          <Button variant="contained" startIcon={<Plus size={17} />} onClick={openAddCustomer} sx={{ ...buttonSx, bgcolor: colors.gold, color: colors.navy, '&:hover': { bgcolor: '#E3C98E' } }}>
            Add customer profile
          </Button>
          <Button variant="outlined" startIcon={<FileText size={17} />} onClick={() => setPage('Applications')} sx={{ ...buttonSx, borderColor: colors.line, color: colors.ink }}>
            Review applications
          </Button>
          <Button variant="outlined" startIcon={<Users size={17} />} onClick={() => setPage('Customers')} sx={{ ...buttonSx, borderColor: colors.line, color: colors.ink }}>
            Manage customers
          </Button>
        </Stack>
      </Paper>
    </>
  );

  const renderCustomers = () => (
    <>
      <SectionHeading
        eyebrow="CUSTOMER MANAGEMENT"
        title="Customer Directory"
        subtitle="View, add and update customer profiles stored in Firestore."
        action={
          <Button
            variant="contained"
            startIcon={<Plus size={17} />}
            onClick={openAddCustomer}
            sx={{ ...buttonSx, bgcolor: colors.gold, color: colors.navy, '&:hover': { bgcolor: '#E3C98E' } }}
          >
            Add Customer
          </Button>
        }
      />

      <Paper sx={{ ...panelSx, overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: 2.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name, email or customer ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} color={colors.muted} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            size="small"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="All">All customers</MenuItem>
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Inactive">Inactive</MenuItem>
          </TextField>
        </Stack>

        <Divider sx={{ borderColor: colors.line }} />

        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: '100%', minWidth: 780, borderCollapse: 'collapse' }}>
            <Box component="thead">
              <Box component="tr" sx={{ backgroundColor: colors.raised }}>
                {['Customer', 'Customer ID', 'Phone', 'Balance', 'Status', 'Actions'].map((heading) => (
                  <Box component="th" key={heading} sx={{ p: 2, textAlign: 'left', fontSize: 10, letterSpacing: 1, color: colors.muted, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {heading.toUpperCase()}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {filteredCustomers.map((customer) => (
                <Box component="tr" key={customer.id} sx={{ borderTop: `1px solid ${colors.line}`, '&:hover': { backgroundColor: colors.raised } }}>
                  <Box component="td" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Avatar sx={{ width: 35, height: 35, bgcolor: dark ? '#293B56' : '#EDE6D7', color: colors.ink, fontSize: 12 }}>
                        {customer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                      </Avatar>
                      <Box>
                        <Typography fontSize={12} fontWeight={700} color={colors.ink}>{customer.name}</Typography>
                        <Typography fontSize={11} color={colors.muted}>{customer.email}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Box component="td" sx={{ p: 2, fontSize: 12, color: colors.muted, whiteSpace: 'nowrap' }}>{customer.customerId}</Box>
                  <Box component="td" sx={{ p: 2, fontSize: 12, color: colors.ink, whiteSpace: 'nowrap' }}>{customer.phone}</Box>
                  <Box component="td" sx={{ p: 2, fontSize: 12, fontWeight: 700, color: colors.ink, whiteSpace: 'nowrap' }}>{money(customer.balance)}</Box>
                  <Box component="td" sx={{ p: 2 }}>
                    <Chip size="small" label={customer.status} color={statusColor[customer.status]} variant="outlined" />
                  </Box>
                  <Box component="td" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Edit customer">
                        <IconButton size="small" onClick={() => openEditCustomer(customer)} sx={{ color: colors.muted }}>
                          <MoreHorizontal size={18} />
                        </IconButton>
                      </Tooltip>
                      <Button size="small" disabled={saving} onClick={() => toggleCustomerStatus(customer)} sx={{ ...buttonSx, color: customer.status === 'Active' ? '#C75A68' : '#2B9A6A', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {customer.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {filteredCustomers.length === 0 && !loading && (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Users size={30} color={colors.muted} />
            <Typography color={colors.ink} fontWeight={700} mt={1}>No customers found</Typography>
            <Typography color={colors.muted} fontSize={12} mt={0.5}>Try another search or filter.</Typography>
          </Box>
        )}

        <Divider sx={{ borderColor: colors.line }} />
        <Typography sx={{ p: 2, color: colors.muted, fontSize: 11 }}>
          Showing {filteredCustomers.length} of {customers.length} Firestore customers · Account balances are read-only
        </Typography>
      </Paper>
    </>
  );

  const renderApplications = () => (
    <>
      <SectionHeading
        eyebrow="ACCOUNT APPROVALS"
        title="Account Applications"
        subtitle="Review submitted applications and save your decision."
        action={
          <Chip
            icon={<Clock3 size={14} />}
            label={`${pendingCount} awaiting review`}
            color="warning"
            variant="outlined"
          />
        }
      />

      <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
        Approve, Hold and Reject decisions are saved in Firestore. Account creation, initial funding, document storage and email notifications are not connected yet.
      </Alert>

      <Stack spacing={2}>
        {applications.map((application) => (
          <Paper key={application.id} sx={{ ...panelSx, p: { xs: 2, sm: 3 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ width: 45, height: 45, bgcolor: dark ? '#293B56' : '#EDE6D7', color: colors.ink }}>
                  {application.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                </Avatar>
                <Box>
                  <Typography fontWeight={700} color={colors.ink}>{application.name}</Typography>
                  <Typography fontSize={11} color={colors.muted}>{application.id} · Submitted {application.date}</Typography>
                </Box>
              </Stack>
              <Chip label={application.status} color={statusColor[application.status]} variant="outlined" sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }} />
            </Stack>

            <Divider sx={{ my: 2, borderColor: colors.line }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Box>
                <Typography fontSize={10} color={colors.muted}>EMAIL ADDRESS</Typography>
                <Typography fontSize={12} fontWeight={600} color={colors.ink} sx={{ overflowWrap: 'anywhere', mt: 0.5 }}>{application.email}</Typography>
              </Box>
              <Box>
                <Typography fontSize={10} color={colors.muted}>PHONE NUMBER</Typography>
                <Typography fontSize={12} fontWeight={600} color={colors.ink} mt={0.5}>{application.phone}</Typography>
              </Box>
              <Box>
                <Typography fontSize={10} color={colors.muted}>ACCOUNT TYPE</Typography>
                <Typography fontSize={12} fontWeight={600} color={colors.ink} mt={0.5}>{application.type}</Typography>
              </Box>
              <Box>
                <Typography fontSize={10} color={colors.muted}>SUBMITTED DOCUMENTS</Typography>
                <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                  <FileText size={14} color={colors.gold} />
                  <Typography fontSize={12} fontWeight={600} color={colors.ink}>{application.documents}</Typography>
                </Stack>
              </Box>
            </Box>

            {application.documentReference && (
              <Typography fontSize={11} color={colors.muted} sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                Document reference: {application.documentReference}
              </Typography>
            )}

            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileText size={15} />}
                disabled
                sx={{ ...buttonSx }}
              >
                Document preview unavailable
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                variant="outlined"
                startIcon={<X size={14} />}
                disabled={saving || application.status === 'Rejected' || application.status === 'Approved'}
                onClick={() => updateApplication(application, 'Rejected')}
                sx={{ ...buttonSx, color: '#C75A68', borderColor: '#C75A6860' }}
              >
                Reject
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Clock3 size={14} />}
                disabled={saving || application.status === 'On Hold' || application.status === 'Approved' || application.status === 'Rejected'}
                onClick={() => updateApplication(application, 'On Hold')}
                sx={{ ...buttonSx, color: colors.gold, borderColor: `${colors.gold}80` }}
              >
                Hold
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<Check size={15} />}
                disabled={saving || application.status === 'Approved' || application.status === 'Rejected'}
                onClick={() => updateApplication(application, 'Approved')}
                sx={{ ...buttonSx, bgcolor: colors.gold, color: colors.navy, '&:hover': { bgcolor: '#E3C98E' } }}
              >
                Approve
              </Button>
            </Stack>
          </Paper>
        ))}

        {applications.length === 0 && !loading && (
          <Paper sx={{ ...panelSx, p: 5, textAlign: 'center' }}>
            <CheckCircle2 size={32} color="#2B9A6A" />
            <Typography color={colors.ink} fontWeight={700} mt={1}>No applications yet</Typography>
          </Paper>
        )}
      </Stack>
    </>
  );

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', md: '252px minmax(0, 1fr)' },
      backgroundColor: colors.background,
      color: colors.ink,
    }}>
      <Box sx={{
        position: { md: 'sticky' },
        top: 0,
        height: { md: '100vh' },
        minHeight: { xs: 'auto', md: '100vh' },
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: '32px 18px 22px' },
        backgroundColor: dark ? '#0B1220' : colors.navy,
        color: '#F5F2EA',
        borderRight: `1px solid ${dark ? colors.line : '#26354F'}`,
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 0.5, mb: { xs: 2, md: 5 } }}>
          <Box sx={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: `1px solid ${colors.gold}`,
            color: colors.gold,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}>
            <ShieldCheck size={21} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: 'Georgia, serif', fontSize: 15, letterSpacing: 1.5, lineHeight: 1.3 }}>
              RICHIE RICH
            </Typography>
            <Typography sx={{ fontSize: 9, color: colors.gold, letterSpacing: 3, mt: 0.5 }}>
              BANK
            </Typography>
          </Box>
        </Stack>

        <Typography sx={{ px: 1.5, mb: 1.5, color: '#A8B0BE', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
          ADMINISTRATION
        </Typography>

        <Stack spacing={0.5}>
          {navItems.map(({ label, icon: Icon }) => {
            const selected = page === label;

            return (
              <Button
                key={label}
                fullWidth
                onClick={() => { setPage(label); setNotice(''); }}
                startIcon={<Icon size={18} />}
                sx={{
                  justifyContent: 'flex-start',
                  gap: 0.5,
                  px: 1.5,
                  py: 1.3,
                  borderRadius: '0 8px 8px 0',
                  borderLeft: selected ? `2px solid ${colors.gold}` : '2px solid transparent',
                  color: selected ? colors.gold : '#A8B0BE',
                  backgroundColor: selected ? '#D7B66D18' : 'transparent',
                  '&:hover': { backgroundColor: '#FFFFFF0D', color: '#F5F2EA' },
                  '& .MuiButton-startIcon': { mr: 1.2 },
                }}
              >
                {label}
              </Button>
            );
          })}
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Box sx={{
          p: 1.5,
          mb: 2,
          borderRadius: 2,
          border: '1px solid #26354F',
          backgroundColor: '#FFFFFF08',
        }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar sx={{ width: 31, height: 31, bgcolor: '#D7B66D', color: colors.navy, fontSize: 12 }}>
              A
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontSize={12} fontWeight={700}>Bank Administrator</Typography>
              <Typography fontSize={10} color="#A8B0BE" noWrap>
                {adminEmail || 'Authenticated Admin'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Button
          fullWidth
          startIcon={<LogOut size={17} />}
          onClick={onExit}
          sx={{
            justifyContent: 'flex-start',
            color: '#A8B0BE',
            border: '1px solid #26354F',
            borderRadius: 2,
            py: 1.1,
            '&:hover': { color: '#F5F2EA', backgroundColor: '#FFFFFF0D' },
          }}
        >
          Exit Administration
        </Button>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Box sx={{
          minHeight: 68,
          px: { xs: 2, md: 4 },
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          backgroundColor: colors.card,
          borderBottom: `1px solid ${colors.line}`,
        }}>
          <Box>
            <Typography fontSize={13} fontWeight={700} color={colors.ink}>
              {page}
            </Typography>
            <Typography fontSize={10} color={colors.muted}>
              Richie Rich Bank / Administration / {page}
            </Typography>
          </Box>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              label="LIVE FIRESTORE"
              size="small"
              sx={{
                display: { xs: 'none', sm: 'flex' },
                fontSize: 9,
                letterSpacing: 1,
                color: '#2B9A6A',
                border: '1px solid #2B9A6A80',
                backgroundColor: '#2B9A6A10',
              }}
            />
            {onToggleMode && (
              <Tooltip title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
                <IconButton onClick={onToggleMode} sx={{ color: colors.ink, border: `1px solid ${colors.line}` }}>
                  {dark ? <Sun size={17} /> : <Moon size={17} />}
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Notifications">
              <IconButton sx={{ color: colors.ink, border: `1px solid ${colors.line}` }}>
                <Bell size={17} />
              </IconButton>
            </Tooltip>
            <Avatar sx={{ width: 34, height: 34, bgcolor: colors.navy, color: colors.gold, fontSize: 12 }}>
              A
            </Avatar>
          </Stack>
        </Box>

        <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, sm: 3, lg: 4 } }}>
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: 2 }}
              action={
                <Button color="inherit" size="small" onClick={loadData}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {notice && (
            <Alert
              severity={noticeType}
              onClose={() => setNotice('')}
              sx={{ mb: 2, borderRadius: 2 }}
            >
              {notice}
            </Alert>
          )}

          {loading ? (
            <Paper sx={{ ...panelSx, p: 5, textAlign: 'center' }}>
              <Typography color={colors.ink} fontWeight={700}>
                Loading bank records from Firestore...
              </Typography>
            </Paper>
          ) : (
            <>
              {page === 'Overview' && renderOverview()}
              {page === 'Customers' && renderCustomers()}
              {page === 'Applications' && renderApplications()}
            </>
          )}

          <Typography sx={{ mt: 4, textAlign: 'center', fontSize: 10, color: colors.muted, letterSpacing: 0.5 }}>
            RICHIE RICH BANK · ADMINISTRATION PORTAL
          </Typography>
        </Box>
      </Box>

      <Dialog
        open={customerDialog}
        onClose={() => !saving && setCustomerDialog(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            backgroundColor: colors.card,
            backgroundImage: 'none',
            border: `1px solid ${colors.line}`,
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ color: colors.ink, fontFamily: 'Georgia, serif', fontSize: 24, pb: 1 }}>
          {editingCustomer ? 'Edit Customer' : 'Add Customer Profile'}
          <Typography fontSize={12} color={colors.muted} mt={0.7}>
            {editingCustomer
              ? 'Update the customer profile details.'
              : 'Enter the details of an existing Firebase Authentication user.'}
          </Typography>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!editingCustomer && (
              <>
                <TextField
                  label="Firebase Authentication UID"
                  fullWidth
                  value={form.uid}
                  onChange={(event) => setForm({ ...form, uid: event.target.value })}
                  helperText="Use the UID of an existing customer account from Firebase Authentication."
                />
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  This creates a Firestore customer profile only. It does not create a Firebase login or a bank account.
                </Alert>
              </>
            )}

            <TextField
              label="Full name"
              fullWidth
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <TextField
              label="Email address"
              type="email"
              fullWidth
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <TextField
              label="Mobile number"
              fullWidth
              value={form.phone}
              inputProps={{ maxLength: 10 }}
              onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '') })}
            />
            {editingCustomer && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Account balance and account number are not editable here.
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button disabled={saving} onClick={() => setCustomerDialog(false)} sx={{ ...buttonSx, color: colors.muted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={saveCustomer}
            sx={{ ...buttonSx, bgcolor: colors.gold, color: colors.navy, '&:hover': { bgcolor: '#E3C98E' } }}
          >
            {saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Profile'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
