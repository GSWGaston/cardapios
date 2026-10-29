import { Info } from 'lucide-react'
import type { NutritionFacts } from '../types'

const nutrients = [
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'carbohydrates', label: 'Carboidratos', unit: 'g' },
  { key: 'fat', label: 'Gorduras totais', unit: 'g' },
] as const

interface Props {
  nutrition?: NutritionFacts
  estimated?: boolean
}

export function NutritionSection({ nutrition, estimated = true }: Props) {
  return (
    <section className="nutrition-section" aria-labelledby="nutrition-title">
      <div className="nutrition-heading">
        <h2 id="nutrition-title">Informações nutricionais</h2>
        {nutrition && <span className="nutrition-serving">Por {nutrition.servingSize}</span>}
      </div>

      {nutrition ? (
        <>
          <ul className="nutrition-grid">
            {nutrients.map(({ key, label, unit }) => (
              <li
                className="nutrition-card"
                key={key}
                aria-label={`${label}: ${nutrition[key]} ${unit}`}
              >
                <div className="nutrition-ring">
                  <svg viewBox="0 0 80 80" focusable="false" aria-hidden="true">
                    <circle className="nutrition-ring-track" cx="40" cy="40" r="30" />
                    <circle className="nutrition-ring-accent" cx="40" cy="40" r="30" />
                  </svg>
                  <span className="nutrition-number" aria-hidden="true">
                    <strong>{nutrition[key]}</strong>
                    <small>{unit}</small>
                  </span>
                </div>
                <span className="nutrition-label" aria-hidden="true">
                  {label}
                </span>
              </li>
            ))}
          </ul>
          <p className="nutrition-note">
            <Info size={14} aria-hidden="true" />
            <span>
              {estimated
                ? 'Valores estimados para demonstração.'
                : 'Valores informados pelo responsável pelo cardápio.'}{' '}
              Referem-se ao produto base, sem adicionais ou acompanhamentos. Os anéis são
              decorativos.
            </span>
          </p>
        </>
      ) : (
        <p className="nutrition-unavailable">
          Informações nutricionais indisponíveis para este produto.
        </p>
      )}
    </section>
  )
}
