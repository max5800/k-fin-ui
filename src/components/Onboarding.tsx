import { ArrowLeft, ArrowRight, Check, Database, Key, Sparkles, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    title: 'Willkommen bei k-fin',
    desc: 'Dein persönliches Finanz-Dashboard mit AI-gestützten Auswertungen. Los geht\u2019s in vier Schritten.',
    icon: Sparkles,
  },
  {
    title: 'Comdirect verbinden',
    desc: 'Hinterlege deinen Comdirect-Zugang. Die Verbindung ist strikt Read-only — wir können nichts überweisen.',
    icon: Key,
  },
  {
    title: 'Kategorien wählen',
    desc: 'Wähle die Kategorien, die du tracken willst. Du kannst später jederzeit eigene hinzufügen.',
    icon: Tag,
  },
  {
    title: 'Fertig',
    desc: 'Dein Dashboard ist bereit. Der erste Sync läuft automatisch im Hintergrund.',
    icon: Check,
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      navigate('/login');
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden font-headline">
      <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        <div className="mb-8">
          <div className="flex gap-2 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-primary' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            Schritt {step + 1} von {STEPS.length}
          </p>
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-low border border-white/5 rounded-3xl p-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-extrabold text-on-surface mb-3 tracking-tight">
            {current.title}
          </h2>
          <p className="text-on-surface-variant leading-relaxed">{current.desc}</p>

          {step === 1 && (
            <div className="mt-8 p-5 rounded-xl bg-surface-container border border-white/5 text-sm text-on-surface-variant">
              <p className="flex items-center gap-2 mb-2 text-on-surface font-bold">
                <Database className="w-4 h-4 text-primary" />
                Hinweis
              </p>
              <p>Die Comdirect-Anbindung wird in den Einstellungen konfiguriert — dieser Schritt ist hier nur ein Platzhalter.</p>
            </div>
          )}
        </motion.div>

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 bg-primary text-on-primary font-bold py-3 px-8 rounded-xl text-sm hover:brightness-110 transition-all"
          >
            {isLast ? 'Zum Login' : 'Weiter'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
