import React from 'react'
import { cn } from './utils'

export interface MusicScoreSheetProps {
  className?: string
  title?: string
  composer?: string
  subtitle?: string
  tempoText?: string
  timeSignature?: string
  activeSystemIndex?: number
  activeMeasure?: number
  selectedInstrument?: string
}

export function MusicScoreSheet({
  className,
  title = 'Sinfonía No. 5 en Do menor',
  composer = 'Ludwig van Beethoven, Op. 67',
  subtitle = 'I. Allegro con brio',
  tempoText = 'Allegro con brio (♩ = 108)',
  timeSignature = '2/4',
  activeSystemIndex,
  activeMeasure,
  selectedInstrument,
}: MusicScoreSheetProps) {
  return (
    <div
      className={cn(
        'w-full h-full flex flex-col justify-between select-none relative overflow-hidden text-slate-200',
        className
      )}
    >
      {/* Score Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800/80 mb-2">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-base sm:text-lg font-serif font-bold tracking-tight text-slate-100">
              {title}
            </h2>
            <span className="text-xs font-serif italic text-amber-400/90 font-medium">
              {subtitle}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-serif">
            {composer} • {timeSignature}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-md text-[11px]">
            <span className="font-serif italic font-semibold text-amber-400">{tempoText}</span>
          </div>
          {selectedInstrument && (
            <span className="text-[10px] text-slate-400 font-mono">
              Parte activa: <strong className="text-amber-400">{selectedInstrument}</strong>
            </span>
          )}
        </div>
      </div>

      {/* SVG Staves Container */}
      <div className="flex-1 w-full relative flex flex-col justify-around py-1">
        {/* System 1: Violín I (The iconic opening motif) */}
        <div className="relative w-full h-[22%] min-h-[70px]">
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
          >
            {/* Staff lines */}
            {[25, 35, 45, 55, 65].map((y) => (
              <line key={y} x1="50" y1={y} x2="980" y2={y} stroke="#cbd5e1" strokeWidth="1.2" opacity="0.85" />
            ))}

            {/* Instrument label */}
            <text x="5" y="48" fill="#94a3b8" fontSize="11" fontFamily="serif" fontWeight="bold">
              Vln. I
            </text>

            {/* System Bracket on left */}
            <line x1="50" y1="25" x2="50" y2="65" stroke="#cbd5e1" strokeWidth="2.5" />

            {/* Treble Clef (𝄞) */}
            <g transform="translate(56, 12) scale(0.7)">
              <path
                d="M18,52 C16,48 15,44 15,40 C15,31 22,23 30,23 C36,23 41,27 41,34 C41,43 32,50 24,54 C15,59 7,66 7,76 C7,89 18,97 30,97 C45,97 53,84 53,70 C53,50 38,36 33,20 C30,11 32,3 36,0 C37,0 38,2 38,5 C38,15 44,28 48,38 C54,52 57,64 57,74 C57,92 45,104 28,104 C11,104 0,92 0,76 C0,62 10,53 20,47 C28,42 34,36 34,30 C34,25 30,21 25,21 C18,21 12,27 12,36 C12,41 14,46 17,50 Z"
                fill="#f1f5f9"
              />
            </g>

            {/* Key Signature (3 Flats: B♭, E♭, A♭) */}
            <g fill="#f1f5f9" transform="translate(100, 0)">
              {/* B flat on 3rd line (y=45) */}
              <text x="0" y="47" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
              {/* E flat on 4th space (y=35) */}
              <text x="12" y="37" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
              {/* A flat on 2nd space (y=55) */}
              <text x="24" y="57" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
            </g>

            {/* Time Signature: 2/4 */}
            <g fill="#f1f5f9" fontFamily="serif" fontWeight="bold" fontSize="18" textAnchor="middle">
              <text x="150" y="42">2</text>
              <text x="150" y="62">4</text>
            </g>

            {/* Dynamics: ff */}
            <text x="168" y="85" fill="#f59e0b" fontSize="13" fontStyle="italic" fontFamily="serif" fontWeight="bold">
              ff
            </text>

            {/* --- MEASURE 1 (Compás 1: Silencio de corchea, Sol, Sol, Sol) --- */}
            {/* Measure number */}
            <text x="175" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">1</text>
            {/* Eighth rest */}
            <path
              d="M185,42 Q188,36 193,38 Q190,45 186,49 L190,58"
              stroke="#f1f5f9"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            {/* 3 Eighth notes (G4, y=45 - 2nd line from top/bottom) */}
            {/* Note 1 */}
            <ellipse cx="215" cy="45" rx="5.5" ry="4" transform="rotate(-20 215 45)" fill="#f1f5f9" />
            <line x1="220" y1="45" x2="220" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            {/* Note 2 */}
            <ellipse cx="240" cy="45" rx="5.5" ry="4" transform="rotate(-20 240 45)" fill="#f1f5f9" />
            <line x1="245" y1="45" x2="245" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            {/* Note 3 */}
            <ellipse cx="265" cy="45" rx="5.5" ry="4" transform="rotate(-20 265 45)" fill="#f1f5f9" />
            <line x1="270" y1="45" x2="270" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            {/* Beam connecting notes 1, 2, 3 */}
            <polygon points="220,18 270,18 270,23 220,23" fill="#f1f5f9" />

            {/* Barline 1 */}
            <line x1="295" y1="25" x2="295" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* --- MEASURE 2 (Compás 2: Mi♭ blanca sostenida con calderón) --- */}
            <text x="300" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">2</text>
            {/* Flat accidental */}
            <text x="320" y="56" fill="#f1f5f9" fontSize="20" fontFamily="serif">♭</text>
            {/* Half note E flat 4 (y=50, 2nd space) */}
            <ellipse cx="345" cy="50" rx="6" ry="4.2" transform="rotate(-20 345 50)" fill="none" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="350" y1="50" x2="350" y2="22" stroke="#f1f5f9" strokeWidth="1.8" />
            {/* Fermata (calderón) above */}
            <path d="M335,16 Q345,6 355,16" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
            <circle cx="345" cy="14" r="1.6" fill="#f59e0b" />

            {/* Barline 2 */}
            <line x1="410" y1="25" x2="410" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* --- MEASURE 3 (Compás 3: Silencio de corchea, Fa, Fa, Fa) --- */}
            <text x="415" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">3</text>
            {/* Eighth rest */}
            <path
              d="M430,42 Q433,36 438,38 Q435,45 431,49 L435,58"
              stroke="#f1f5f9"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            {/* 3 Eighth notes (F4, y=40 - 1st space) */}
            <ellipse cx="460" cy="40" rx="5.5" ry="4" transform="rotate(-20 460 40)" fill="#f1f5f9" />
            <line x1="465" y1="40" x2="465" y2="15" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="485" cy="40" rx="5.5" ry="4" transform="rotate(-20 485 40)" fill="#f1f5f9" />
            <line x1="490" y1="40" x2="490" y2="15" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="510" cy="40" rx="5.5" ry="4" transform="rotate(-20 510 40)" fill="#f1f5f9" />
            <line x1="515" y1="40" x2="515" y2="15" stroke="#f1f5f9" strokeWidth="1.8" />
            {/* Beam */}
            <polygon points="465,13 515,13 515,18 465,18" fill="#f1f5f9" />

            {/* Barline 3 */}
            <line x1="540" y1="25" x2="540" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* --- MEASURE 4 (Compás 4: Re blanca sostenida con calderón) --- */}
            <text x="545" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">4</text>
            {/* Half note D4 (y=60, 4th line from top) */}
            <ellipse cx="585" cy="60" rx="6" ry="4.2" transform="rotate(-20 585 60)" fill="none" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="590" y1="60" x2="590" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />
            {/* Fermata */}
            <path d="M575,20 Q585,10 595,20" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
            <circle cx="585" cy="18" r="1.6" fill="#f59e0b" />

            {/* Barline 4 */}
            <line x1="650" y1="25" x2="650" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* --- MEASURE 5 (Compás 5: Inicio del desarrollo enérgico) --- */}
            <text x="655" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">5</text>
            <text x="658" y="85" fill="#f59e0b" fontSize="12" fontStyle="italic" fontFamily="serif">p cresc.</text>
            {/* Beamed pairs: G4, Eb4, F4, D4 */}
            <ellipse cx="680" cy="45" rx="5.5" ry="4" transform="rotate(-20 680 45)" fill="#f1f5f9" />
            <line x1="685" y1="45" x2="685" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="705" cy="50" rx="5.5" ry="4" transform="rotate(-20 705 50)" fill="#f1f5f9" />
            <line x1="710" y1="50" x2="710" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="685,18 710,18 710,23 685,23" fill="#f1f5f9" />

            <ellipse cx="735" cy="40" rx="5.5" ry="4" transform="rotate(-20 735 40)" fill="#f1f5f9" />
            <line x1="740" y1="40" x2="740" y2="16" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="760" cy="60" rx="5.5" ry="4" transform="rotate(-20 760 60)" fill="#f1f5f9" />
            <line x1="765" y1="60" x2="765" y2="16" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="740,14 765,14 765,19 740,19" fill="#f1f5f9" />

            {/* Barline 5 */}
            <line x1="795" y1="25" x2="795" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* --- MEASURE 6-8 (Compases continuos) --- */}
            <text x="800" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">6</text>
            <ellipse cx="825" cy="45" rx="5.5" ry="4" transform="rotate(-20 825 45)" fill="#f1f5f9" />
            <line x1="830" y1="45" x2="830" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="850" cy="35" rx="5.5" ry="4" transform="rotate(-20 850 35)" fill="#f1f5f9" />
            <line x1="855" y1="35" x2="855" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="830,18 855,18 855,23 830,23" fill="#f1f5f9" />

            <ellipse cx="880" cy="30" rx="5.5" ry="4" transform="rotate(-20 880 30)" fill="#f1f5f9" />
            <line x1="885" y1="30" x2="885" y2="12" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="905" cy="25" rx="5.5" ry="4" transform="rotate(-20 905 25)" fill="#f1f5f9" />
            <line x1="910" y1="25" x2="910" y2="12" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="885,10 910,10 910,15 885,15" fill="#f1f5f9" />

            {/* Barline 6 */}
            <line x1="935" y1="25" x2="935" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            {/* Half note quarter note completion */}
            <ellipse cx="955" cy="35" rx="5.5" ry="4" transform="rotate(-20 955 35)" fill="#f1f5f9" />
            <line x1="960" y1="35" x2="960" y2="15" stroke="#f1f5f9" strokeWidth="1.8" />

            {/* End barline of system */}
            <line x1="980" y1="25" x2="980" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          </svg>
        </div>

        {/* System 2: Violín II */}
        <div className="relative w-full h-[22%] min-h-[70px]">
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
          >
            {[25, 35, 45, 55, 65].map((y) => (
              <line key={y} x1="50" y1={y} x2="980" y2={y} stroke="#cbd5e1" strokeWidth="1.2" opacity="0.85" />
            ))}

            <text x="5" y="48" fill="#94a3b8" fontSize="11" fontFamily="serif" fontWeight="bold">
              Vln. II
            </text>
            <line x1="50" y1="25" x2="50" y2="65" stroke="#cbd5e1" strokeWidth="2.5" />

            {/* Treble Clef */}
            <g transform="translate(56, 12) scale(0.7)">
              <path
                d="M18,52 C16,48 15,44 15,40 C15,31 22,23 30,23 C36,23 41,27 41,34 C41,43 32,50 24,54 C15,59 7,66 7,76 C7,89 18,97 30,97 C45,97 53,84 53,70 C53,50 38,36 33,20 C30,11 32,3 36,0 C37,0 38,2 38,5 C38,15 44,28 48,38 C54,52 57,64 57,74 C57,92 45,104 28,104 C11,104 0,92 0,76 C0,62 10,53 20,47 C28,42 34,36 34,30 C34,25 30,21 25,21 C18,21 12,27 12,36 C12,41 14,46 17,50 Z"
                fill="#f1f5f9"
              />
            </g>

            {/* Key Signature */}
            <g fill="#f1f5f9" transform="translate(100, 0)">
              <text x="0" y="47" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
              <text x="12" y="37" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
              <text x="24" y="57" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
            </g>

            {/* Time signature */}
            <g fill="#f1f5f9" fontFamily="serif" fontWeight="bold" fontSize="18" textAnchor="middle">
              <text x="150" y="42">2</text>
              <text x="150" y="62">4</text>
            </g>

            <text x="168" y="85" fill="#f59e0b" fontSize="13" fontStyle="italic" fontFamily="serif" fontWeight="bold">
              ff
            </text>

            {/* Measure 1 */}
            <text x="175" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">1</text>
            <path d="M185,42 Q188,36 193,38 Q190,45 186,49 L190,58" stroke="#f1f5f9" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Notes: G4 unison */}
            <ellipse cx="215" cy="45" rx="5.5" ry="4" transform="rotate(-20 215 45)" fill="#f1f5f9" />
            <line x1="220" y1="45" x2="220" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="240" cy="45" rx="5.5" ry="4" transform="rotate(-20 240 45)" fill="#f1f5f9" />
            <line x1="245" y1="45" x2="245" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="265" cy="45" rx="5.5" ry="4" transform="rotate(-20 265 45)" fill="#f1f5f9" />
            <line x1="270" y1="45" x2="270" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="220,18 270,18 270,23 220,23" fill="#f1f5f9" />

            <line x1="295" y1="25" x2="295" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 2: Eb4 half note with fermata */}
            <text x="300" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">2</text>
            <text x="320" y="56" fill="#f1f5f9" fontSize="20" fontFamily="serif">♭</text>
            <ellipse cx="345" cy="50" rx="6" ry="4.2" transform="rotate(-20 345 50)" fill="none" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="350" y1="50" x2="350" y2="22" stroke="#f1f5f9" strokeWidth="1.8" />
            <path d="M335,16 Q345,6 355,16" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
            <circle cx="345" cy="14" r="1.6" fill="#f59e0b" />

            <line x1="410" y1="25" x2="410" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 3: F4 */}
            <text x="415" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">3</text>
            <path d="M430,42 Q433,36 438,38 Q435,45 431,49 L435,58" stroke="#f1f5f9" strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="460" cy="40" rx="5.5" ry="4" transform="rotate(-20 460 40)" fill="#f1f5f9" />
            <line x1="465" y1="40" x2="465" y2="15" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="485" cy="40" rx="5.5" ry="4" transform="rotate(-20 485 40)" fill="#f1f5f9" />
            <line x1="490" y1="40" x2="490" y2="15" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="510" cy="40" rx="5.5" ry="4" transform="rotate(-20 510 40)" fill="#f1f5f9" />
            <line x1="515" y1="40" x2="515" y2="15" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="465,13 515,13 515,18 465,18" fill="#f1f5f9" />

            <line x1="540" y1="25" x2="540" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 4: D4 half note */}
            <text x="545" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">4</text>
            <ellipse cx="585" cy="60" rx="6" ry="4.2" transform="rotate(-20 585 60)" fill="none" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="590" y1="60" x2="590" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />
            <path d="M575,20 Q585,10 595,20" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
            <circle cx="585" cy="18" r="1.6" fill="#f59e0b" />

            <line x1="650" y1="25" x2="650" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 5-8 */}
            <text x="655" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">5</text>
            <text x="658" y="85" fill="#f59e0b" fontSize="12" fontStyle="italic" fontFamily="serif">p</text>
            {/* Chords / rhythmic accompaniment */}
            <ellipse cx="680" cy="55" rx="5.5" ry="4" transform="rotate(-20 680 55)" fill="#f1f5f9" />
            <line x1="685" y1="55" x2="685" y2="28" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="710" cy="55" rx="5.5" ry="4" transform="rotate(-20 710 55)" fill="#f1f5f9" />
            <line x1="715" y1="55" x2="715" y2="28" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="740" y1="25" x2="740" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <text x="745" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">6</text>
            <ellipse cx="770" cy="50" rx="5.5" ry="4" transform="rotate(-20 770 50)" fill="#f1f5f9" />
            <line x1="775" y1="50" x2="775" y2="25" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="800" cy="50" rx="5.5" ry="4" transform="rotate(-20 800 50)" fill="#f1f5f9" />
            <line x1="805" y1="50" x2="805" y2="25" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="835" y1="25" x2="835" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <text x="840" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">7</text>
            <ellipse cx="865" cy="45" rx="5.5" ry="4" transform="rotate(-20 865 45)" fill="#f1f5f9" />
            <line x1="870" y1="45" x2="870" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="895" cy="45" rx="5.5" ry="4" transform="rotate(-20 895 45)" fill="#f1f5f9" />
            <line x1="900" y1="45" x2="900" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="935" y1="25" x2="935" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <ellipse cx="955" cy="40" rx="5.5" ry="4" transform="rotate(-20 955 40)" fill="#f1f5f9" />
            <line x1="960" y1="40" x2="960" y2="18" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="980" y1="25" x2="980" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          </svg>
        </div>

        {/* System 3: Viola (Alto clef) */}
        <div className="relative w-full h-[22%] min-h-[70px]">
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
          >
            {[25, 35, 45, 55, 65].map((y) => (
              <line key={y} x1="50" y1={y} x2="980" y2={y} stroke="#cbd5e1" strokeWidth="1.2" opacity="0.85" />
            ))}

            <text x="8" y="48" fill="#94a3b8" fontSize="11" fontFamily="serif" fontWeight="bold">
              Vla.
            </text>
            <line x1="50" y1="25" x2="50" y2="65" stroke="#cbd5e1" strokeWidth="2.5" />

            {/* Alto Clef (Clave de Do en 3ra línea) */}
            <g transform="translate(60, 22) scale(0.65)" fill="#f1f5f9">
              <path d="M5,5 L10,5 L10,60 L5,60 Z M12,5 L15,5 L15,60 L12,60 Z M15,5 Q32,5 32,25 Q32,32 23,33 Q32,34 32,42 Q32,60 15,60 L18,52 Q26,52 26,42 Q26,35 15,35 L15,31 Q26,31 26,25 Q26,13 18,13 Z" />
            </g>

            {/* Key Signature */}
            <g fill="#f1f5f9" transform="translate(100, 0)">
              <text x="0" y="52" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
              <text x="12" y="42" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
              <text x="24" y="62" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
            </g>

            {/* Time signature */}
            <g fill="#f1f5f9" fontFamily="serif" fontWeight="bold" fontSize="18" textAnchor="middle">
              <text x="150" y="42">2</text>
              <text x="150" y="62">4</text>
            </g>

            <text x="168" y="85" fill="#f59e0b" fontSize="13" fontStyle="italic" fontFamily="serif" fontWeight="bold">
              ff
            </text>

            {/* Measure 1 */}
            <text x="175" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">1</text>
            <path d="M185,42 Q188,36 193,38 Q190,45 186,49 L190,58" stroke="#f1f5f9" strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="215" cy="55" rx="5.5" ry="4" transform="rotate(-20 215 55)" fill="#f1f5f9" />
            <line x1="220" y1="55" x2="220" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="240" cy="55" rx="5.5" ry="4" transform="rotate(-20 240 55)" fill="#f1f5f9" />
            <line x1="245" y1="55" x2="245" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="265" cy="55" rx="5.5" ry="4" transform="rotate(-20 265 55)" fill="#f1f5f9" />
            <line x1="270" y1="55" x2="270" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="220,28 270,28 270,33 220,33" fill="#f1f5f9" />

            <line x1="295" y1="25" x2="295" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 2 */}
            <text x="300" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">2</text>
            <text x="320" y="66" fill="#f1f5f9" fontSize="20" fontFamily="serif">♭</text>
            <ellipse cx="345" cy="60" rx="6" ry="4.2" transform="rotate(-20 345 60)" fill="none" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="350" y1="60" x2="350" y2="32" stroke="#f1f5f9" strokeWidth="1.8" />
            <path d="M335,16 Q345,6 355,16" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
            <circle cx="345" cy="14" r="1.6" fill="#f59e0b" />

            <line x1="410" y1="25" x2="410" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 3 */}
            <text x="415" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">3</text>
            <path d="M430,42 Q433,36 438,38 Q435,45 431,49 L435,58" stroke="#f1f5f9" strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="460" cy="50" rx="5.5" ry="4" transform="rotate(-20 460 50)" fill="#f1f5f9" />
            <line x1="465" y1="50" x2="465" y2="25" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="485" cy="50" rx="5.5" ry="4" transform="rotate(-20 485 50)" fill="#f1f5f9" />
            <line x1="490" y1="50" x2="490" y2="25" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="510" cy="50" rx="5.5" ry="4" transform="rotate(-20 510 50)" fill="#f1f5f9" />
            <line x1="515" y1="50" x2="515" y2="25" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="465,23 515,23 515,28 465,28" fill="#f1f5f9" />

            <line x1="540" y1="25" x2="540" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 4 */}
            <text x="545" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">4</text>
            {/* Ledger line for middle note */}
            <ellipse cx="585" cy="45" rx="6" ry="4.2" transform="rotate(-20 585 45)" fill="none" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="590" y1="45" x2="590" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />
            <path d="M575,16 Q585,6 595,16" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
            <circle cx="585" cy="14" r="1.6" fill="#f59e0b" />

            <line x1="650" y1="25" x2="650" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 5-8 */}
            <text x="655" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">5</text>
            <ellipse cx="680" cy="65" rx="5.5" ry="4" transform="rotate(-20 680 65)" fill="#f1f5f9" />
            <line x1="685" y1="65" x2="685" y2="38" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="710" cy="60" rx="5.5" ry="4" transform="rotate(-20 710 60)" fill="#f1f5f9" />
            <line x1="715" y1="60" x2="715" y2="38" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="740" y1="25" x2="740" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <text x="745" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">6</text>
            <ellipse cx="770" cy="55" rx="5.5" ry="4" transform="rotate(-20 770 55)" fill="#f1f5f9" />
            <line x1="775" y1="55" x2="775" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="800" cy="50" rx="5.5" ry="4" transform="rotate(-20 800 50)" fill="#f1f5f9" />
            <line x1="805" y1="50" x2="805" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="835" y1="25" x2="835" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <text x="840" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">7</text>
            <ellipse cx="865" cy="45" rx="5.5" ry="4" transform="rotate(-20 865 45)" fill="#f1f5f9" />
            <line x1="870" y1="45" x2="870" y2="22" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="895" cy="40" rx="5.5" ry="4" transform="rotate(-20 895 40)" fill="#f1f5f9" />
            <line x1="900" y1="40" x2="900" y2="22" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="935" y1="25" x2="935" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <ellipse cx="955" cy="45" rx="5.5" ry="4" transform="rotate(-20 955 45)" fill="#f1f5f9" />
            <line x1="960" y1="45" x2="960" y2="22" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="980" y1="25" x2="980" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          </svg>
        </div>

        {/* System 4: Violonchelo y Contrabajo (Bass clef) */}
        <div className="relative w-full h-[22%] min-h-[70px]">
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
          >
            {[25, 35, 45, 55, 65].map((y) => (
              <line key={y} x1="50" y1={y} x2="980" y2={y} stroke="#cbd5e1" strokeWidth="1.2" opacity="0.85" />
            ))}

            <text x="10" y="48" fill="#94a3b8" fontSize="11" fontFamily="serif" fontWeight="bold">
              Vc.
            </text>
            <line x1="50" y1="25" x2="50" y2="65" stroke="#cbd5e1" strokeWidth="2.5" />

            {/* Bass Clef (Clave de Fa) */}
            <g transform="translate(56, 18) scale(0.65)" fill="#f1f5f9">
              <path d="M12,20 C12,12 18,6 26,6 C34,6 40,12 40,20 C40,32 28,45 15,55 L12,52 C22,44 32,32 32,22 C32,15 28,12 24,12 C18,12 14,16 14,20 Z" />
              <circle cx="45" cy="14" r="2.5" />
              <circle cx="45" cy="26" r="2.5" />
            </g>

            {/* Key Signature */}
            <g fill="#f1f5f9" transform="translate(100, 0)">
              <text x="0" y="55" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
              <text x="12" y="45" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
              <text x="24" y="65" fontSize="22" fontFamily="serif" fontWeight="bold">♭</text>
            </g>

            {/* Time signature */}
            <g fill="#f1f5f9" fontFamily="serif" fontWeight="bold" fontSize="18" textAnchor="middle">
              <text x="150" y="42">2</text>
              <text x="150" y="62">4</text>
            </g>

            <text x="168" y="85" fill="#f59e0b" fontSize="13" fontStyle="italic" fontFamily="serif" fontWeight="bold">
              ff
            </text>

            {/* Measure 1: Octave unison on C/G */}
            <text x="175" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">1</text>
            <path d="M185,42 Q188,36 193,38 Q190,45 186,49 L190,58" stroke="#f1f5f9" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Notes: G3 (y=35, 4th line) */}
            <ellipse cx="215" cy="35" rx="5.5" ry="4" transform="rotate(-20 215 35)" fill="#f1f5f9" />
            <line x1="210" y1="35" x2="210" y2="60" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="240" cy="35" rx="5.5" ry="4" transform="rotate(-20 240 35)" fill="#f1f5f9" />
            <line x1="235" y1="35" x2="235" y2="60" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="265" cy="35" rx="5.5" ry="4" transform="rotate(-20 265 35)" fill="#f1f5f9" />
            <line x1="260" y1="35" x2="260" y2="60" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="210,60 260,60 260,65 210,65" fill="#f1f5f9" />

            <line x1="295" y1="25" x2="295" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 2: Eb3 with fermata */}
            <text x="300" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">2</text>
            <text x="320" y="46" fill="#f1f5f9" fontSize="20" fontFamily="serif">♭</text>
            <ellipse cx="345" cy="42" rx="6" ry="4.2" transform="rotate(-20 345 42)" fill="none" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="340" y1="42" x2="340" y2="68" stroke="#f1f5f9" strokeWidth="1.8" />
            <path d="M335,16 Q345,6 355,16" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
            <circle cx="345" cy="14" r="1.6" fill="#f59e0b" />

            <line x1="410" y1="25" x2="410" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 3: F3 */}
            <text x="415" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">3</text>
            <path d="M430,42 Q433,36 438,38 Q435,45 431,49 L435,58" stroke="#f1f5f9" strokeWidth="2" fill="none" strokeLinecap="round" />
            <ellipse cx="460" cy="30" rx="5.5" ry="4" transform="rotate(-20 460 30)" fill="#f1f5f9" />
            <line x1="455" y1="30" x2="455" y2="55" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="485" cy="30" rx="5.5" ry="4" transform="rotate(-20 485 30)" fill="#f1f5f9" />
            <line x1="480" y1="30" x2="480" y2="55" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="510" cy="30" rx="5.5" ry="4" transform="rotate(-20 510 30)" fill="#f1f5f9" />
            <line x1="505" y1="30" x2="505" y2="55" stroke="#f1f5f9" strokeWidth="1.8" />
            <polygon points="455,55 505,55 505,60 455,60" fill="#f1f5f9" />

            <line x1="540" y1="25" x2="540" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 4: D3 with fermata */}
            <text x="545" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">4</text>
            <ellipse cx="585" cy="50" rx="6" ry="4.2" transform="rotate(-20 585 50)" fill="none" stroke="#f1f5f9" strokeWidth="2" />
            <line x1="580" y1="50" x2="580" y2="76" stroke="#f1f5f9" strokeWidth="1.8" />
            <path d="M575,16 Q585,6 595,16" stroke="#f59e0b" strokeWidth="1.8" fill="none" />
            <circle cx="585" cy="14" r="1.6" fill="#f59e0b" />

            <line x1="650" y1="25" x2="650" y2="65" stroke="#94a3b8" strokeWidth="1.2" />

            {/* Measure 5-8: Driving low C string notes */}
            <text x="655" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">5</text>
            {/* Low C ledger line below staff (y=75) */}
            <line x1="672" y1="75" x2="688" y2="75" stroke="#cbd5e1" strokeWidth="1.2" />
            <ellipse cx="680" cy="75" rx="5.5" ry="4" transform="rotate(-20 680 75)" fill="#f1f5f9" />
            <line x1="685" y1="75" x2="685" y2="48" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="702" y1="75" x2="718" y2="75" stroke="#cbd5e1" strokeWidth="1.2" />
            <ellipse cx="710" cy="75" rx="5.5" ry="4" transform="rotate(-20 710 75)" fill="#f1f5f9" />
            <line x1="715" y1="75" x2="715" y2="48" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="740" y1="25" x2="740" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <text x="745" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">6</text>
            <ellipse cx="770" cy="65" rx="5.5" ry="4" transform="rotate(-20 770 65)" fill="#f1f5f9" />
            <line x1="775" y1="65" x2="775" y2="40" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="800" cy="65" rx="5.5" ry="4" transform="rotate(-20 800 65)" fill="#f1f5f9" />
            <line x1="805" y1="65" x2="805" y2="40" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="835" y1="25" x2="835" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <text x="840" y="18" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">7</text>
            <ellipse cx="865" cy="55" rx="5.5" ry="4" transform="rotate(-20 865 55)" fill="#f1f5f9" />
            <line x1="870" y1="55" x2="870" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />
            <ellipse cx="895" cy="55" rx="5.5" ry="4" transform="rotate(-20 895 55)" fill="#f1f5f9" />
            <line x1="900" y1="55" x2="900" y2="30" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="935" y1="25" x2="935" y2="65" stroke="#94a3b8" strokeWidth="1.2" />
            <ellipse cx="955" cy="45" rx="5.5" ry="4" transform="rotate(-20 955 45)" fill="#f1f5f9" />
            <line x1="960" y1="45" x2="960" y2="20" stroke="#f1f5f9" strokeWidth="1.8" />

            <line x1="980" y1="25" x2="980" y2="65" stroke="#cbd5e1" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </div>
  )
}
