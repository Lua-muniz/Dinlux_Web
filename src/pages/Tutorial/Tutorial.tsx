import { useState } from 'react'
import { TUTORIAL_TOPICS } from './tutorialContent'
import './Tutorial.css'

export default function Tutorial() {
  const [selectedId, setSelectedId] = useState(TUTORIAL_TOPICS[0].id)
  const selected = TUTORIAL_TOPICS.find((topic) => topic.id === selectedId) ?? TUTORIAL_TOPICS[0]

  return (
    <div className="tutorial">
      <section className="home-card listas-sidebar">
        <div className="listas-sidebar-header">
          <strong>Tutorial</strong>
        </div>

        <div className="listas-list-rows">
          {TUTORIAL_TOPICS.map((topic) => (
            <div
              key={topic.id}
              className={`listas-list-row ${topic.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(topic.id)}
            >
              <span className="listas-list-title">{topic.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-card listas-main tutorial-main">
        <h2 className="tutorial-title">{selected.title}</h2>

        {selected.steps.length === 0 ? (
          <p className="finance-empty-text">Tutorial em construção.</p>
        ) : (
          <div className="tutorial-steps">
            {selected.steps.map((step, index) => (
              <div key={index} className="tutorial-step">
                <p className="tutorial-step-text">{step.text}</p>
                <div className="tutorial-step-images">
                  {step.images.map((src) => (
                    <img key={src} src={src} alt="" className="tutorial-step-image" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
