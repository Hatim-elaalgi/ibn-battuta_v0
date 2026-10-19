import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const SECTIONS = [
    {
        plate: 'I',
        title: 'On the man',
        body: (
            <>
                <p>
                    Abū Abdallah Muḥammad ibn Battūta was born in Tangier in 1304 and
                    left it, on horseback, at twenty-one. He intended a hajj. He returned
                    in his fifties, having travelled some 120,000 kilometres by sea, by
                    camel, and on foot &mdash; through Mecca, Cairo, Damascus, Delhi,
                    the Maldives, Sumatra, Hangzhou. The Sultan of Morocco, on his
                    return, ordered him to dictate it. The book is called the <em>Rihla</em>.
                </p>
                <p>
                    He died in Tangier around 1369. Where exactly is uncertain. A small
                    tomb in the medina bears his name; whether he is in it is a question
                    nobody asks too loudly.
                </p>
            </>
        ),
    },
    {
        plate: 'II',
        title: 'On the voice',
        body: (
            <>
                <p>
                    The Ibn Battuta you converse with here is a <em>persona</em> &mdash; a
                    voice modeled on the tone of the <em>Rihla</em>, on what we know of
                    his curiosities, on the cadence of medieval Arabic travel writing
                    after it was translated into the languages of his readers. It is
                    not him. He has been dead seven centuries.
                </p>
                <p>
                    What it is, instead, is a careful guess at how he might have
                    described the city if he were walking it with you in the present
                    tense &mdash; with weather and prayer times and restaurants
                    threaded in, gently, in the places where they would have come up.
                </p>
            </>
        ),
    },
    {
        plate: 'III',
        title: 'On the design',
        body: (
            <>
                <p>
                    Bone, ink, ochre. Two surfaces, three inks, one accent. No
                    saturated colour appears anywhere in the product. No rounded
                    corners. No drop shadows. Hairlines and whitespace do the work.
                    This is restraint by intent &mdash; we wanted something quiet
                    enough to walk with.
                </p>
                <p>
                    Cormorant Garamond and EB Garamond carry the headlines and the
                    body. JetBrains Mono is reserved for the moments we need a
                    numeral &mdash; a time, a distance, a coordinate. Amiri carries
                    the Arabic, set with equal dignity, never as decoration.
                </p>
            </>
        ),
    },
    {
        plate: 'IV',
        title: 'On the data',
        body: (
            <>
                <p>
                    Weather and air quality are read every ten minutes from
                    Open-Meteo. Prayer times from Aladhan, by your coordinates.
                    Restaurants and landmarks are queried from OpenStreetMap. Events
                    come from Ticketmaster, Guichet.com, and Moroccan culture-press
                    RSS. Holidays from Nager.Date. News from BBC, Al Jazeera, Reuters.
                </p>
                <p>
                    Routes are computed by OSRM. The map tiles are OpenStreetMap. The
                    3D portrait is a Meshy-generated bust with viseme-driven lip-sync
                    against a Microsoft Edge neural voice. None of these are us. We
                    are the editor.
                </p>
            </>
        ),
    },
    {
        plate: 'V',
        title: 'On you',
        body: (
            <>
                <p>
                    This is a private experiment, freely shared. Nothing you say
                    here is stored beyond the lifetime of your conversation. We do
                    not have analytics. We do not have advertisers. If you stay,
                    stay because you wanted to.
                </p>
            </>
        ),
    },
];

export default function About() {
    return (
        <div className="h-full overflow-y-auto bg-bone">
            <div className="max-w-3xl mx-auto px-7 md:px-12 py-12">

                <div className="t-caption">— Plate IX · About</div>

                <h1 className="mt-3 leading-none"
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontStyle:  'italic',
                        fontWeight: 300,
                        fontSize:   'clamp(44px, 7vw, 88px)',
                        letterSpacing: '-0.02em',
                    }}>
                    Who is this voice,<br />and how much<br />of him is real.
                </h1>

                <p className="t-lede mt-9 italic" style={{ fontSize: '19px' }}>
                    A short colophon, in five plates, on the man, the voice, the
                    design, and you.
                </p>

                <div className="mt-16 space-y-16">
                    {SECTIONS.map((s, i) => (
                        <motion.section
                            key={s.plate}
                            initial={{ opacity: 0, y: 14 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-15%' }}
                            transition={{ duration: 0.8, ease: [0.2, 0.65, 0.2, 1], delay: 0.05 * i }}
                        >
                            <div className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                                — Plate {s.plate}
                            </div>
                            <h2 className="mt-3 leading-tight"
                                style={{
                                    fontFamily: 'var(--font-display)',
                                    fontStyle:  'italic',
                                    fontWeight: 300,
                                    fontSize:   '36px',
                                    letterSpacing: '-0.012em',
                                }}>
                                {s.title}
                            </h2>
                            <div className="prose-tangier mt-6 space-y-5"
                                 style={{
                                     fontFamily: 'var(--font-body)',
                                     fontSize:   '17px',
                                     lineHeight: 1.65,
                                     color:      'var(--color-ink)',
                                 }}>
                                {s.body}
                            </div>
                        </motion.section>
                    ))}
                </div>

                {/* Closing */}
                <div className="mt-20 pt-10 border-t border-line text-center">
                    <span className="text-ochre"
                          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '32px' }}>
                        ⁂
                    </span>
                    <p className="t-lede mt-4 italic" style={{ fontSize: '17px' }}>
                        — Welcome. Stay as long as you like.
                    </p>
                    <Link to="/walk"
                          className="inline-block mt-8 t-caption hover:text-ink transition-colors"
                          style={{ color: 'var(--color-ochre)' }}>
                        ↵ Begin the walk
                    </Link>
                </div>
            </div>
        </div>
    );
}
