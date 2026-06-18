import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, Check, X, AlertCircle, RotateCcw } from 'lucide-react';

export default function TotpManagement() {
  const navigate = useNavigate();
  const [userSecurity, setUserSecurity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disabling, setDisabling] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmTotpCode, setConfirmTotpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDisableForm, setShowDisableForm] = useState(false);

  useEffect(() => {
    const loadUserSecurity = async () => {
      try {
        const user = await base44.auth.me();
        const records = await base44.entities.UserSecurity.filter(
          { user_id: user.id },
          '-created_date',
          1
        );
        if (records.length > 0) {
          setUserSecurity(records[0]);
        }
      } catch (err) {
        setError('Failed to load 2FA settings');
      } finally {
        setLoading(false);
      }
    };
    loadUserSecurity();
  }, []);

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setDisabling(true);

    try {
      // Verify TOTP code to allow disabling
      const response = await base44.functions.invoke('verifyTotp', {
        token: confirmTotpCode,
      });

      if (!response.data.verified) {
        setError('Invalid TOTP code');
        setDisabling(false);
        return;
      }

      // Disable 2FA
      await base44.entities.UserSecurity.update(userSecurity.id, {
        is_totp_enabled: false,
        totp_secret: null,
        backup_codes: null,
      });

      setSuccess('Two-factor authentication has been disabled');
      setShowDisableForm(false);
      setCurrentPassword('');
      setConfirmTotpCode('');

      // Reload user security
      const user = await base44.auth.me();
      const records = await base44.entities.UserSecurity.filter(
        { user_id: user.id },
        '-created_date',
        1
      );
      if (records.length > 0) {
        setUserSecurity(records[0]);
      }
    } catch (err) {
      setError('Failed to disable 2FA: ' + err.message);
    } finally {
      setDisabling(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="page-container max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div>
          <h1 className="section-title mb-2">Two-Factor Authentication</h1>
          <p className="text-sm text-muted-foreground">Manage your account security settings.</p>
        </div>

        {success && (
          <div className="p-4 bg-chart-2/10 rounded-lg flex gap-3">
            <Check className="w-5 h-5 text-chart-2 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-chart-2">{success}</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="border-l-4 border-primary pl-4 py-2">
          <p className="font-medium text-sm mb-1">Status</p>
          <div className="flex items-center gap-2">
            {userSecurity?.is_totp_enabled ? (
              <>
                <Check className="w-4 h-4 text-chart-2" />
                <span className="text-sm text-foreground">2FA is <strong>enabled</strong></span>
              </>
            ) : (
              <>
                <X className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">2FA is <strong>disabled</strong></span>
              </>
            )}
          </div>
        </div>

        {userSecurity?.is_totp_enabled && (
          <div className="border-l-4 border-primary pl-4 py-2 space-y-2">
            <p className="font-medium text-sm">Last Verified</p>
            <p className="text-sm text-muted-foreground">
              {userSecurity.last_totp_verify
                ? new Date(userSecurity.last_totp_verify).toLocaleString('en-GB')
                : 'Not yet verified in this session'}
            </p>
          </div>
        )}

        {userSecurity?.is_totp_enabled && (
          <div className="space-y-3">
            <button
              onClick={() => navigate('/totp-setup')}
              className="w-full px-4 py-2.5 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset 2FA Setup
            </button>

            {!showDisableForm ? (
              <button
                onClick={() => setShowDisableForm(true)}
                className="w-full px-4 py-2.5 border border-destructive text-destructive rounded-lg font-medium hover:bg-destructive/5"
              >
                Disable 2FA
              </button>
            ) : (
              <form onSubmit={handleDisable2FA} className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Enter your TOTP code to confirm disabling 2FA:</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  pattern="[0-9]{6}"
                  value={confirmTotpCode}
                  onChange={(e) => setConfirmTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-center font-mono text-2xl tracking-widest"
                  autoFocus
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={confirmTotpCode.length !== 6 || disabling}
                    className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {disabling ? 'Disabling...' : 'Confirm Disable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisableForm(false);
                      setConfirmTotpCode('');
                    }}
                    className="flex-1 px-4 py-2 border border-border rounded-lg font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {!userSecurity?.is_totp_enabled && (
          <button
            onClick={() => navigate('/totp-setup')}
            className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90"
          >
            Enable 2FA Now
          </button>
        )}
      </div>
    </div>
  );
}