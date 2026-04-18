import { ArrowRight, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { useLogin } from '../api/auth';

const loginSchema = z.object({
  email: z.string().email('Gültige E-Mail erforderlich'),
  password: z.string().min(6, 'Mindestens 6 Zeichen'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const login = useLogin();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    try {
      const res = await login.mutateAsync(data);
      localStorage.setItem('kfin_token', res.access_token);
      navigate('/');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setAuthError('E-Mail oder Passwort ungültig');
      } else if (isAxiosError(err) && err.response?.status === 404) {
        setAuthError('Anmeldung am Server nicht verfügbar');
      } else {
        setAuthError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
      }
    }
  };

  const isConnecting = login.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden font-headline">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-surface-container-low border border-white/5 rounded-3xl p-10 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-primary uppercase tracking-tighter">k-fin</h1>
          <p className="text-on-surface-variant text-sm mt-2">Deine Finanzen. Klar.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              E-Mail
            </label>
            <div className="bg-surface-container-lowest px-4 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-primary/50 transition-all">
              <Mail className="w-4 h-4 text-on-surface-variant shrink-0" />
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className="bg-transparent border-none focus:ring-0 outline-none text-on-surface text-sm w-full py-3 placeholder:text-on-surface-variant/30"
              />
            </div>
            {errors.email && (
              <p className="text-[10px] text-error font-bold">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Passwort
            </label>
            <div className="bg-surface-container-lowest px-4 rounded-xl flex items-center gap-3 border border-transparent focus-within:border-primary/50 transition-all">
              <Lock className="w-4 h-4 text-on-surface-variant shrink-0" />
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="bg-transparent border-none focus:ring-0 outline-none text-on-surface text-sm w-full py-3 placeholder:text-on-surface-variant/30 font-sans"
              />
            </div>
            {errors.password && (
              <p className="text-[10px] text-error font-bold">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end text-xs">
            <button type="button" className="text-primary hover:text-primary/80 transition-colors font-bold">
              Passwort vergessen?
            </button>
          </div>

          {authError && (
            <p className="text-xs text-error font-bold text-center" role="alert">
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full bg-primary text-on-primary font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Anmelden...
              </>
            ) : (
              <>
                Anmelden
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
            <ShieldCheck className="w-3 h-3" />
            <span>Verschlüsselte Übertragung</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="w-full bg-white/5 hover:bg-white/10 text-on-surface font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            Neu hier? Einrichten
          </button>
        </div>
      </motion.div>
    </div>
  );
}
