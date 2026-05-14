# SM Manager Lessons (curado por Reescritor desde feedback de Oráculo)

> Archivo append-only. Cada lección viene de un rejection de Oráculo + rewrite del Reescritor.
> El Social Media Manager LEE este archivo al inicio de cada generación de ideas y lo usa
> como guía anti-regresión: las próximas ideas deben evitar los patrones que Oráculo rechaza
> y seguir los patrones que Oráculo aprueba.

> Formato: ## YYYY-MM-DD
> Cada entrada tiene: rejected_pattern, oraculo_critique, rewrite_pattern, segment_anchor.

---

## Patrones aprendidos (rolling window — últimas 50)

### 2026-05-08 — Caption karaoke style (Jorge directo, NO viene de Oráculo)
- **rejected_pattern**: "Reels con captions karaoke (\\kf word-by-word color sweep) burned-in via libass subtitles filter"
- **oraculo_critique**: N/A — orden directa Jorge
- **rewrite_pattern**: "Reels NO usan captions karaoke. El texto del slide ya está pintado en el HTML (scene_layout.mjs slide_text). El estilo karaoke solo se aplica en Videos (long-form 30-60s, format='Video'). Director v2 ahora gatea: `isVideoFormat = recordFormat === 'Video'` antes de generar `.ass` files."
- **segment_anchor**: ALL — aplica a todos los Reels independiente del segment

### 2026-05-07 — Video length rule (Jorge directo, NO viene de Oráculo)
- **Rejected pattern**: Reels con duration > 15 segundos
- **Oráculo critique**: N/A — esta es regla directa del Jefe, anti-regresión permanente
- **Rewrite pattern**: Si concepto necesita más story → dividir en serie "Topic — Parte 1 / Parte 2 / Parte 3", cada parte JSON narrative B con duration 7-15. NUNCA un solo Reel >15s.
- **Segment anchor**: aplica a TODOS los segments


### 2026-05-07 — Testimonio #4 — Jubilado Haciendo Downsizing
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Testimonio #3 — Pareja en Divorcio
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Green Bay Real Estate — Oportunidades 2026
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Pinnacle Holdings — Nuestra Misión
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Testimonio #4 — Jubilado Haciendo Downsizing
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Testimonio #2 — Propietario con Inquilinos Problemáticos
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — ¿Qué hace Pinnacle Holdings?
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — S7 - Propiedad Heredada — Solución Rápida Post
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Herencia de Propiedad — ¿Qué Hago Ahora?
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — ¿Por Qué Wisconsin? La Historia de Pinnacle
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Testimonio — Familia Martínez
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Divorcio y Propiedades — ¿Qué Pasa con la Casa?
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Jorge Cruz: Cómo Evité Perder Mi Casa en Wisconsin
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Story Interactiva — ¿En qué situación estás?
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Mito #2 — Solo Compran Casas en Mal Estado
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — TEST E2E — Plan A faceless premium
- **Rejected pattern**: Generic hook with no segment anchor, no empathy, no educational frame, and missing pinnaclegroupwi.com in caption.
- **Oráculo critique**: Content addressed no specific distressed segment, used salesy tone ('fast, simple, no surprises'), and omitted the required website URL — scoring only 2/10.
- **Rewrite pattern**: Anchor to Pre-Foreclosure segment immediately in hook, reframe all slides around homeowner's fear and relief journey, replace salesy language with empathetic education, add pinnaclegroupwi.com to caption and full CTA.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — ¿Llevas meses sin dormir por la hipoteca atrasada?
- **Rejected pattern**: Hook was visceral but the reel stayed surface-level — never addressed the homeowner's core fear ('this is a scam / they'll lowball me'), leaving the educational gap that triggers skepticism and disengagement.
- **Oráculo critique**: Strong Segment 1 hook undercut by a purely transactional body ('one call, one visit, same-day cash offer') and pushy slogan ('Cash for Your House') that contradicts Pinnacle's no-pressure positioning and fails to overcome the lowball/scam objection.
- **Rewrite pattern**: Kept the Pre-Foreclosure emotional entry point but built an educational arc across slides 2-4: awareness of options → specific benefit of acting before foreclosure (credit protection) → autonomy framing ('your timeline'). CTA softened to 'know your options' to match trust-first positioning.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — S3 - Behind the Scenes: Jorge Evalúa una Propiedad
- **Rejected pattern**: Generic 'we visit your house' framing with no segment anchor and a salesy hype CTA ('Cash. Fast. Fair.') that contradicts an empathy-first voice.
- **Oráculo critique**: Too broad — no distressed segment addressed, no specific pain point activated. CTA felt pushy and promotional rather than educational and warm.
- **Rewrite pattern**: Anchored explicitly to Tired Landlord segment in the hook. Shifted each slide to the homeowner's lived experience (no repairs needed, honest walkthrough, same-day number). CTA softened to a low-pressure invitation. Removed all hype language.
- **Segment anchor**: Tired-Landlord

### 2026-05-07 — S3 - Behind the Scenes: Jorge Evalúa una Propiedad
- **Rejected pattern**: Hook genérico en inglés ('This is what happens when we visit your house') + CTA transaccional ('we buy any house') sin ancla emocional ni segmento específico.
- **Oráculo critique**: El contenido no abordaba ningún segmento concreto, usaba lenguaje de comprador genérico nacional, y carecía de empatía hacia el propietario en angustia. Tono frío y corporativo.
- **Rewrite pattern**: Anclar al segmento Inherited desde el hook ('¿Heredaste una casa?'), reformular desde el POV del propietario (su alivio, su miedo a reparaciones), tono cálido y sin jerga inversora, CTA suave con teléfono y sitio web.
- **Segment anchor**: Inherited

### 2026-05-07 — ¿Quién es Jorge Cruz?
- **Rejected pattern**: Historia del fundador centrada en el trayecto personal de Jorge, sin anclaje a ningún segmento de propietario en crisis.
- **Oráculo critique**: El contenido funcionaba como branding del fundador, no como contenido de servicio al público objetivo. Ninguno de los 6 segmentos en crisis se veía reflejado; además el hashtag 'HouseInvestor' introdujo jerga de inversor.
- **Rewrite pattern**: Anclar la narrativa al dolor del segmento Inherited (heredero abrumado), hablar desde la perspectiva del propietario, eliminar toda referencia a la historia personal del fundador como protagonista, y presentar la solución en términos de alivio y simplicidad.
- **Segment anchor**: Inherited

### 2026-05-07 — ¿Quién es Jorge Cruz?
- **Rejected pattern**: Founder-centric origin story framed around personal achievement ('immigrant to investor'), with a salesy CTA ('Cash for Your House. Fast. Fair.') and no connection to any specific distressed homeowner segment.
- **Oráculo critique**: Content centered on Jorge's story rather than the homeowner's pain. The hook failed to reflect any of the 6 distressed segments. 'Real estate investor' label activated audience skepticism. CTA felt pushy and generic.
- **Rewrite pattern**: Reframed Jorge's backstory as empathy credential — his experience earns trust without making the content about him. Each slide now speaks to the homeowner's reality (pressure, stress, need for honest options). CTA is warm and personal, not transactional.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — Cierre del Mes — Reflexión de Jorge
- **Rejected pattern**: El Reel original era completamente autorreferencial — celebraba a Jorge y a Pinnacle (deals cerrados, impacto de la empresa) sin anclarse en ningún segmento de propietario en crisis ni en el dolor real del audiencia objetivo.
- **Oráculo critique**: Contenido centrado en el vendedor (Jorge/Pinnacle), no en el comprador. Usó jerga de inversionista ('deals cerrados'). No abordó ninguno de los 6 segmentos de propietarios en dificultad. Tono autopromocionaly genérico.
- **Rewrite pattern**: Se reencuadró el 'cierre de mes' como un testimonio de empatía hacia los propietarios. Se anclaron los puntos en experiencias reales de segmentos (herencia, atrasos, separación). Se eliminó toda jerga de inversionista y se sustituyó por lenguaje de alivio y opciones. Jorge aparece en hook y CTA (template hybrid) pero el foco narrativo son las familias, no Pinnacle.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — Historia Personal — Mi Primer Deal
- **Rejected pattern**: First-person investor origin story using deal-centric language ('my first deal', 'deal of a lifetime') that centers Jorge's investment journey, not a homeowner's pain point.
- **Oráculo critique**: Content spoke to a real estate investor audience, used prohibited jargon ('deal', 'budget repairs'), and anchored to zero of the 6 distressed homeowner segments. No Wisconsin homeowner in distress would self-identify with the narrative.
- **Rewrite pattern**: Anchor to Inherited segment from the homeowner's POV — their emotional overwhelm, logistical burden, and desire for a simple exit — using warm empathetic language and zero investor terminology. Jorge presence kept to hook and CTA only (hybrid template).
- **Segment anchor**: Inherited

### 2026-05-07 — S4 - Jorge Habla: Por Qué Fundé Pinnacle Holdings
- **Rejected pattern**: Generic founder-origin story with no segment anchor, repeated duplicate slide copy ('No pressure, no commitment' appeared twice), and a transactional CTA that undercut the trust-building intent of the personal angle.
- **Oráculo critique**: Zero segment-specific language made the reel invisible to any distressed homeowner scrolling their feed. No foreclosure, taxes, divorce, or other trigger word appeared. The hook was tolerable but the CTA reverted to salesy mode, destroying the warmth the founder angle was trying to build.
- **Rewrite pattern**: Anchor the founder story to a concrete Pre-Foreclosure moment (neighbor losing their home) so distressed homeowners self-identify immediately. Each slide advances a homeowner-POV narrative — problem witnessed, mission formed, promise made — rather than promoting the company. CTA stays warm and conversational, not transactional.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — S6 - Oferta de Efectivo en 24 Horas Reel
- **Rejected pattern**: Generic cash-buyer promo with no segment-specific pain, using 'guaranteed' and stacked slogans ('Fast. Fair.') that feel hype-driven and untrustworthy.
- **Oráculo critique**: Content failed to address Segment 6 relocation triggers (job transfer, tight timeline, state-to-state move). Tone was salesy. 'Guaranteed' is an FTC red flag. No homeowner POV or empathy present.
- **Rewrite pattern**: Anchor every slide to the S6 relocation pain arc: the urgency of a job transfer → the need for a fast, private sale → closing on the homeowner's timeline. Warm, educational tone replaces hype. 'Guaranteed' removed entirely.
- **Segment anchor**: Relocation

### 2026-05-07 — Is Your Green Bay Home Worth More Than You Owe?
- **Rejected pattern**: —
- **Oráculo critique**: —
- **Rewrite pattern**: —
- **Segment anchor**: —

### 2026-05-07 — Facing Foreclosure in Wisconsin? Know Your Options
- **Rejected pattern**: Slide copy ended with 'no realtor fees' — framing the offer transactionally from Pinnacle's POV, which tips into pitch-mode and away from homeowner-centered empathy. The hook was emotionally flat ('feeling stuck' is too vague to open sharp curiosity).
- **Oráculo critique**: Score 6 — concept and segment anchor were solid (Pre-Foreclosure, Segment 1), tone was mostly warm, but 'no realtor fees' leaned transactional and the hook lacked specificity. Oráculo flagged it as slightly seller-pitch rather than homeowner-first.
- **Rewrite pattern**: Replaced transactional slide 3 ('no repairs, no showings, no realtor fees') with an empathy-first outcome ('a simple, honest conversation shows you the path'). Sharpened hook to a contrast structure — acknowledging the pain point while immediately signaling hope. Caption reframes around homeowner agency ('you still have choices') instead of Pinnacle's offer terms.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — What Really Happens When We Walk Through Your Home
- **Rejected pattern**: Slides used generic cash-buyer selling points ('repairs don't need to happen', 'clear number same day') that apply to all six segments, erasing the landlord-specific pain and making the content feel like a mass-market pitch rather than a targeted message.
- **Oráculo critique**: Hook correctly targeted Tired Landlord (Segment 5) but the body slides abandoned segment specificity — no mention of problem tenants, cash-flow drain, or landlord exhaustion. Generic body copy diluted the precision of the hook and lowered relevance score.
- **Rewrite pattern**: Maintained the Tired Landlord anchor throughout all three body slides — slide 2 addresses the hassle of the process (no crews, no judgment), slide 3 directly names the damage and headaches unique to rental properties, slide 4 delivers the relief beat (you know where you stand). Segment pain is present in every slide, not just the hook.
- **Segment anchor**: Tired-Landlord

### 2026-05-07 — Cómo evaluamos tu casa heredada (sin juicios, sin presión)
- **Rejected pattern**: El slide inicial ('Visitamos la propiedad y vemos su valor real') sonaba procedimental y centrado en Pinnacle, no en el dolor emocional del heredero.
- **Oráculo critique**: El concepto era sólido para Segment 2, pero el tono se volvía transaccional en el primer punto, perdiendo la empatía necesaria para un heredero emocionalmente sobrecargado.
- **Rewrite pattern**: Reencuadrar cada slide desde la perspectiva emocional del heredero: primero valida el peso emocional de la propiedad, luego elimina el esfuerzo logístico, y cierra con la promesa de rapidez y simplicidad.
- **Segment anchor**: Inherited

### 2026-05-07 — Heredé una casa en Wisconsin y no sabía qué hacer
- **Rejected pattern**: CTA genérico sin ancla de tiempo específica; frase 'sin sorpresas de último momento' implica garantía absoluta (riesgo FTC); cierre expresado en semanas sin precisión suficiente para generar confianza.
- **Oráculo critique**: El Oráculo señaló falta de especificidad en el ancla de confianza ('Cerramos en semanas' vs. '24 horas para tu oferta'), riesgo de garantía implícita en 'sin sorpresas de último momento', y necesidad de suavizar lenguaje de compromiso absoluto.
- **Rewrite pattern**: Se reemplazó el ancla vaga por '24 horas' como promesa de oferta (no de cierre garantizado). Se eliminó 'sin sorpresas de último momento' y se sustituyó por 'elige la fecha de cierre que más te convenga', que empodera al propietario sin prometer resultados absolutos. Hook reformulado como pregunta directa al segmento.
- **Segment anchor**: Inherited

### 2026-05-07 — Cierre del Mes — Reflexión de Jorge
- **Rejected pattern**: Generic personal-branding 'monthly reflection' with no segment anchor, no homeowner pain point, and a hollow caption that simply repeated the hook before pivoting abruptly to a sales CTA.
- **Oráculo critique**: Score=2. Zero connection to any distressed segment. Hook 'End of another month' speaks to no one in crisis. Caption barely exists and the CTA felt jarring with no empathy bridge.
- **Rewrite pattern**: Reframe the 'end of month' moment as the emotional trigger pre-foreclosure homeowners feel — bill anxiety, mounting arrears. Each slide now addresses a specific fear or relief point for that segment. CTA is warm and educational ('know your options') rather than transactional.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — He Helps Wisconsin Families Keep Their Dignity When Selling
- **Rejected pattern**: Generic hook ('tough home situation') with no segment anchor; Jorge backstory used as the main message without tying it to a specific homeowner pain point; investor-coded hashtag (#HouseInvestor) undermined brand voice.
- **Oráculo critique**: Hook failed to identify any of the 6 distressed segments. Warmth was present but unfocused. Hashtag introduced investor framing explicitly banned by guidelines.
- **Rewrite pattern**: Hook now names the Pre-Foreclosure segment explicitly ('missed mortgage payments'). Jorge backstory repositioned as empathy bridge, not the main message. All slides anchor to homeowner relief (no fees, no showings, honest options). Investor hashtag removed entirely.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — Un mes, familias reales: lo que aprendí ayudando en Wisconsi
- **Rejected pattern**: Hook centrado en el narrador ('esto lo aprendí') y segmento vago ('familias en crisis') sin anclar a ninguno de los 6 segmentos específicos.
- **Oráculo critique**: El contenido no nombraba ningún segmento distressed específico; permanecía a nivel genérico. El hook era auto-referencial en lugar de orientado al dolor del propietario.
- **Rewrite pattern**: Hook reenfocado en el dolor directo del heredero ('Heredaste una casa y estás agobiado'). Segmento anclado explícitamente a Inherited Property. Cada slide aborda una barrera concreta del heredero: confusión de opciones, miedo a reparaciones/comisiones, y urgencia de cierre rápido.
- **Segment anchor**: Inherited

### 2026-05-07 — Inherited a House in Wisconsin? Here's What No One Tells You
- **Rejected pattern**: Hashtags included '#RealEstateInvestor' and '#FirstDeal', which injected investor-side language and persona that directly contradicts the distressed homeowner audience and broke the homeowner-first POV frame.
- **Oráculo critique**: Concept and tone were largely approved — Segment 2 targeting was accurate and caption warmth was on-point. Rejection was triggered solely by hashtag choices that signaled investor content to the algorithm and the viewer, undermining trust with the intended homeowner audience.
- **Rewrite pattern**: Preserved all slide content and visual direction. Removed all investor-coded hashtags from caption. Replaced with homeowner-empathy hashtags implicitly embedded in caption prose. No jargon, no investor framing anywhere in output.
- **Segment anchor**: Inherited

### 2026-05-07 — Why a Wisconsin Family's Crisis Changed Everything for Me
- **Rejected pattern**: Abstract origin story with no geographic specificity, no urgency trigger, and no actionable timeline — kept the audience at arm's length emotionally and practically
- **Oráculo critique**: Foreclosure framing was on-target for Segment 1 but the story lacked a specific Wisconsin county reference, missed the 14-45 day close window urgency, and slide copy was too generic to create real emotional traction
- **Rewrite pattern**: Anchored the story to Milwaukee (specific county), introduced a concrete timeline ('under 30 days'), kept empathy-led tone but added urgency through deadline language — 'before the deadline hits' mirrors the segment's lived panic without being pushy
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — Job Transfer? Here's How to Sell Before You Move
- **Rejected pattern**: Hook was generic ('Relocating fast with a house left?') and copy leaned on investor-facing phrases like 'real cash offer' and 'no listing needed,' which trigger skepticism in distressed homeowners who fear being lowballed.
- **Oráculo critique**: Concept was correctly anchored to Segment 6 (Relocation) but lacked empathy depth. The hook did not distinguish voluntary relocation from job-loss pressure. 'Real cash offer' and 'no listing needed' read as a sales pitch rather than a homeowner-first education frame.
- **Rewrite pattern**: Replaced 'real cash offer' with 'every option' language to reduce skepticism and center the homeowner's decision-making. Hook softened to feel conversational. Slides reframed around the homeowner's timeline and peace of mind, not Pinnacle's process. CTA preserved 'know your options' — the most trusted framing for this audience.
- **Segment anchor**: Relocation

### 2026-05-07 — Heredaste una casa en Wisconsin y no sabes qué hacer
- **Rejected pattern**: Spanish title paired with English-only content created audience confusion; CTA 'Cash for Your House' was transactional and salesy, breaking the empathetic no-pressure tone established in the slides.
- **Oráculo critique**: Language mismatch between title and body left both Spanish and English audiences underserved. 'Cash for Your House' read as a pitch, not a reassurance — inconsistent with the warm, grief-aware framing of the hook.
- **Rewrite pattern**: 100% English throughout all fields. Replaced transactional CTA with a low-pressure 'know your options' frame. Reanchored each slide to the inheritor's emotional and logistical pain (grief, obligation, uncertainty) rather than Pinnacle's service features. Visuals softened to match a contemplative, empathetic mood.
- **Segment anchor**: Inherited

### 2026-05-07 — S6 - Oferta de Efectivo en 24 Horas Reel
- **Rejected pattern**: Pitch genérico de velocidad sin anclar a ninguna situación de vida real; uso de 'garantizado' (prohibido por compliance); tono orientado al vendedor, no al dolor del propietario.
- **Oráculo critique**: El reel nunca nombraba el segmento S6 ni su dolor específico (traslado, presión de tiempo, doble gasto). 'Garantizado' viola las guías de marca. 'Efectivo, rápido, justo' suena a pitch de inversionista, no a empatía.
- **Rewrite pattern**: Abrir con la situación exacta del segmento S6 (traslado de trabajo, casa sin vender). Describir el dolor concreto (pagar dos lugares). Presentar la solución como alivio, no como promesa absoluta. Eliminar 'garantizado'; reemplazar con 'en menos de 24 horas' (aspiracional, no garantía legal). Cerrar con CTA cálido.
- **Segment anchor**: Relocation

### 2026-05-07 — ¿Preocupado por perder tu casa en Wisconsin? Hay opciones
- **Rejected pattern**: Title in Spanish on an EN record caused a language mismatch; CTA phrase 'Cash for Your House' read as transactional and salesy; hook line repeated verbatim in caption, wasting caption space; visual flux prompts contained Spanish text fragments.
- **Oráculo critique**: Language inconsistency (Spanish title on EN record), transactional CTA tone, verbatim hook repetition in caption, and Spanish text embedded in flux prompts — all weakened segment precision and brand voice.
- **Rewrite pattern**: Title now fully in English and segment-specific. CTA reframed from transactional ('Cash for Your House') to empowerment-driven ('Know your options'). Caption uses all-new copy that extends the narrative rather than repeating the hook. Flux prompts are 100% English. Each slide carries a distinct, substantive point building from awareness → relief → action.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — S4 - Jorge Habla: Por Qué Fundé Pinnacle Holdings
- **Rejected pattern**: Historia del fundador genérica sin ancla a un segmento específico; hook y caption mezclaban inglés y español; duplicación de líneas en slides; sin mención de dolor concreto del propietario.
- **Oráculo critique**: El reel no se conectaba con ninguno de los 6 segmentos de propietarios en dificultades. La ejecución bilingüe estaba rota con hook y caption en inglés a pesar de Language=ES. Las líneas de slides eran duplicadas y genéricas.
- **Rewrite pattern**: Se ancló la historia personal de Jorge al segmento Pre-Foreclosure (miedo a perder la casa por deudas). El hook abre con el dolor específico del segmento. Cada slide aborda una etapa emocional real del propietario. Todo el contenido está 100% en español con ortografía correcta.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-07 — Cuando Jorge llegó, Marta no sabía qué iba a pasar con su ca
- **Rejected pattern**: Name inconsistency across title, caption, and visuals (Marta vs Maria vs Jorge) eroded authenticity; '#RealEstateInvestor' hashtag broke brand voice by signaling investor perspective instead of homeowner empathy.
- **Oráculo critique**: Identity confusion between character names across touchpoints undermined trust with a skeptical inherited-property audience. Investor-facing hashtag violated brand voice. Slides were truncated and incomplete, failing the 8–14 word substantive-line requirement.
- **Rewrite pattern**: Unified a single consistent character name (Maria) across all fields; removed all investor hashtags; each slide now carries a complete, homeowner-POV sentence meeting word count; Jorge is named only in slide 4 as the empathetic guide, not the protagonist.
- **Segment anchor**: Inherited

### 2026-05-07 — Historia Personal — Mi Primer Deal
- **Rejected pattern**: Historia en primera persona enmarcada como 'guerra de deals' de inversionista — jargón ('deal', 'bienes raíces como vehículo de inversión'), dirigida a audiencia de inversionistas, sin conexión con ninguno de los seis segmentos de propietarios en crisis.
- **Oráculo critique**: El contenido hablaba AL inversionista, no AL propietario en estrés. Usó lenguaje de deal-making ('primer deal', 'presupuesto') y carecía de cualquier ancla emocional o situacional para los segmentos definidos.
- **Rewrite pattern**: Se reencuadró la misma historia personal de Jorge como evidencia de experiencia que BENEFICIA al vendedor en crisis (casa con problemas, sin reparaciones requeridas). El protagonista del reel pasa a ser el propietario con miedo de que su casa no valga nada — Jorge es solo la prueba social. Se eliminó todo jargón de inversión.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-08 — Facing Foreclosure in Wisconsin? You Still Have Choices
- **Rejected pattern**: Reassurance-only framing — content told the viewer 'you have options' but never explained what those options actually do or why selling early beats waiting.
- **Oráculo critique**: Segment targeting was correct but the educational mechanism (sell before foreclosure = credit protection + control) was missing, leaving the audience without a decision framework. Caption was also too thin to build enough trust or urgency.
- **Rewrite pattern**: Each slide now carries a concrete, specific benefit of early voluntary sale — credit protection, control vs bank takeover, flexible timeline — so the viewer understands the 'why' and can make an informed decision, not just feel reassured.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-08 — What a Walkthrough Looks Like for a Tired Landlord
- **Rejected pattern**: Process-forward framing ('we walk once, no contractors') centered Pinnacle's workflow rather than the landlord's emotional relief. Caption URL was also flagged as a compliance risk.
- **Oráculo critique**: Segment targeting and visual concept were strong. Primary failures: slide copy leaned transactional/process-focused instead of empathy-first, and the caption was missing pinnaclegroupwi.com causing a compliance flag.
- **Rewrite pattern**: Lead with the homeowner's emotional state (tired, done, ready to move on), then frame each process step as a relief benefit — 'no judgment,' 'fair number,' 'know your options.' URL restored in caption to meet compliance.
- **Segment anchor**: Tired-Landlord

### 2026-05-08 — Heredaste una casa y no sabes qué hacer con ella
- **Rejected pattern**: Hook emocional genérico ('llena de recuerdos') sin anclar al dolor logístico real del heredero — distancia geográfica, proceso de sucesión y agobio operativo nunca mencionados.
- **Oráculo critique**: El reel apuntaba al Segmento 2 pero omitió los detonadores clave: vivir lejos de la propiedad, navegar el proceso de probate y la carga logística de gestionar una casa en otro estado o ciudad.
- **Rewrite pattern**: Cada slide ahora activa un detonador específico del segmento: Slide 2 = distancia geográfica, Slide 3 = complejidad legal (probate), Slide 4 = estado físico de la propiedad. El hook abre con el problema concreto ('que no puedes atender') en lugar de un gancho puramente sentimental.
- **Segment anchor**: Inherited

### 2026-05-08 — Heredé una casa en Wisconsin y no sabía por dónde empezar
- **Rejected pattern**: CTA directo con '24 horas' sin suavizar el tono comercial; caption omitía pinnaclegroupwi.com
- **Oráculo critique**: El concepto y el segmento eran correctos (Inherited Property), pero 'Recibe una oferta en 24 horas' sonaba a hype de vendedor. Además, la caption no incluía el sitio web obligatorio pinnaclegroupwi.com.
- **Rewrite pattern**: Se reemplazó la promesa de velocidad por un marco de 'conocer opciones sin presión', que empodera al heredero sin sonar a pitch. Se agregó pinnaclegroupwi.com al caption. Tono empático mantenido en todo momento.
- **Segment anchor**: Inherited

### 2026-05-08 — Behind on Payments? Wisconsin Families Have Options
- **Rejected pattern**: Title used 'Wisconsin Families' (familial-status Fair Housing risk) and slides stayed generic — Jorge-centered rather than homeowner-pain-centered. CTA lacked website.
- **Oráculo critique**: Segment targeting was correct (Pre-Foreclosure) but 'Families' language raised Fair Housing concern; slides lacked a specific Wisconsin urgency anchor and felt Jorge-promotional rather than homeowner-empowering.
- **Rewrite pattern**: Replaced 'Families' with neutral homeowner framing. Added concrete urgency anchor ('lender letter') in hook. Reframed each slide from homeowner's POV — their fear, their choice, their relief. Added pinnaclegroupwi.com to CTA and caption.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-08 — Heredé una casa en Wisconsin y no sabía qué hacer
- **Rejected pattern**: Hook declarativo sin tensión: 'Heredaste una casa y estás agobiado' es una afirmación que no abre curiosidad ni invita a seguir viendo.
- **Oráculo critique**: El hook no creaba una brecha de curiosidad suficiente para detener el scroll. Era una declaración, no una pregunta o tensión que jalara al espectador hacia la solución.
- **Rewrite pattern**: Convertir el hook en pregunta directa al segmento ('¿Heredaste una casa y no sabes qué sigue?') para abrir una brecha de curiosidad inmediata. Los slides profundizan el dolor específico antes de ofrecer la solución, respetando el arco educativo del canal.
- **Segment anchor**: Inherited

### 2026-05-08 — Inherited a House in Wisconsin? Know Your Real Options
- **Rejected pattern**: Hook and slides addressed logistics (repairs, taxes, timeline) but stayed surface-level — no emotional acknowledgment of probate overwhelm, out-of-state burden, or the grief/stress layer that Segment 2 actually carries.
- **Oráculo critique**: Persona targeting was correct but emotional depth was insufficient. Caption lacked mention of probate and the specific out-of-state overwhelm that makes inherited properties uniquely stressful. Copy was warm but read more like a feature list than an empathy-first narrative.
- **Rewrite pattern**: Lead with the specific geographic and emotional tension (inherited from afar + probate). Each slide now names a concrete pain point before offering relief. Slide 4 adds timeline flexibility framed around the inheritor's control, not Pinnacle's process. Caption opens with empathy and closes with low-pressure invitation.
- **Segment anchor**: Inherited

### 2026-05-08 — A Wisconsin Family Almost Lost Their Home — Here's What I Le
- **Rejected pattern**: Story was framed from the founder's POV ('I built Pinnacle') rather than centering the homeowner's emotional journey. The caption used slash-separated fragments that read as choppy and disconnected rather than as a warm, flowing narrative.
- **Oráculo critique**: Foreclosure segment match was strong and Milwaukee geography was credible, but the founder-centric framing diluted emotional resonance. Caption format was fragmented and reduced readability.
- **Rewrite pattern**: Recentered every slide on the homeowner's experience — their fear, their discovery of options, their relief at closing. Founder and brand are implied through outcome, not stated directly. Caption rewritten as a single cohesive paragraph with warm, empathetic voice.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-08 — Job Transfer Coming? Sell Your Home Without the Stress
- **Rejected pattern**: Hook named the situation without amplifying emotional tension; slides stayed surface-level and generic ('walk you through every option') without grounding the pain in the homeowner's lived experience of deadline pressure and financial anxiety.
- **Oráculo critique**: Hook was functional but bland — described the scenario without making the viewer feel the urgency. Slides lacked specificity and emotional weight. Tone was safe but too passive to drive engagement from a genuinely time-pressured segment.
- **Rewrite pattern**: Hook rewritten as a direct question that mirrors the homeowner's exact mental conflict (start date set, house unresolved). Slides now escalate: first anchors the time pressure concretely, second offers empathetic guidance, third delivers the specific relief outcome (close before day one). Every line speaks to the homeowner's fear, not Pinnacle's service list.
- **Segment anchor**: Relocation

### 2026-05-08 — When the Month Ends and the Bills Don't Stop
- **Rejected pattern**: Slide copy used 'protect your credit and your dignity' as a firm implied promise without hedging — reads as a guaranteed outcome. Caption also omitted the required pinnaclegroupwi.com URL, failing the mandatory CTA compliance check.
- **Oráculo critique**: Score 6 reject. Segment fit and tone were solid. Two fixable issues: (1) soft-promise language needed a hedge to avoid implying guaranteed outcomes; (2) caption was missing pinnaclegroupwi.com.
- **Rewrite pattern**: Added 'may help' hedge to the credit-protection claim to soften the implied guarantee. Rewrote caption to naturally include both (920) 777-9886 and pinnaclegroupwi.com. Kept empathetic, no-pressure framing and homeowner POV throughout. No investor jargon introduced.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-08 — You Inherited a Wisconsin Home — Here's What to Know
- **Rejected pattern**: Slide copy listed seller benefits as features ('no repairs, no cleaning, no showings') — read as a pitch rather than education, breaking the trust-first frame needed for grieving inheritors.
- **Oráculo critique**: Hook was too generic ('you have options' closes curiosity instead of opening it). Slides 2-4 leaned toward feature promotion rather than validating the inheritor's emotional and logistical reality first. Score capped at 6 because the reel told them what Pinnacle offers before earning enough emotional trust.
- **Rewrite pattern**: Lead with the emotional truth (grief is heavy), then introduce a knowledge gap they didn't know existed (private sale option), then reframe the process as low-intrusion — letting the benefit emerge naturally from context rather than listing it as a feature.
- **Segment anchor**: Inherited

### 2026-05-08 — ¿Te mudas pronto y necesitas vender tu casa rápido?
- **Rejected pattern**: El original enumeró ventajas del proceso (sin agentes, sin visitas, sin retrasos) en lugar de abordar el miedo central del segmento: '¿cerrarán realmente antes de mi fecha de mudanza?'
- **Oráculo critique**: El concepto tocaba el dolor correcto (gastos dobles) pero omitía el miedo más profundo del Segmento 6: la incertidumbre sobre si el comprador cumplirá el plazo de cierre. Además, 'oferta en efectivo sobre la mesa' sonaba a hype de vendedor.
- **Rewrite pattern**: La diapositiva 3 nombra directamente el miedo al cierre a tiempo. La diapositiva 4 responde ese miedo con la promesa de oferta en 24 horas Y fecha de cierre flexible, sin jerga de inversionista.
- **Segment anchor**: Relocation

### 2026-05-08 — Worried About Losing Your Wisconsin Home? You Have Options
- **Rejected pattern**: English-language reel undermined by hashtags or framing that signaled a Hispanic/Latino identity frame, creating a persona-language mismatch that confused the audience signal.
- **Oráculo critique**: Body copy and segment targeting were strong (Pre-Foreclosure, Wisconsin-specific, warm tone, no jargon), but identity framing outside the slides contradicted the EN-language designation and sent mixed signals about the intended audience.
- **Rewrite pattern**: Kept all effective body copy elements intact. Removed any bilingual or ethnic-identity framing. Anchored every element — title, hook, slides, caption — cleanly to the Pre-Foreclosure segment in plain, warm English with no persona-signal ambiguity.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-08 — Por Qué Ayudo a Familias Que Casi Pierden Su Casa
- **Rejected pattern**: El guión giraba hacia la historia del fundador ('Por eso fundé Pinnacle'), desplazando el foco del dolor del propietario hacia la marca. Esto debilita la resonancia con el segmento y genera un giro comercial prematuro.
- **Oráculo critique**: El Oráculo detectó que la narrativa de origen del fundador interrumpe la conexión emocional con el propietario en pre-ejecución hipotecaria. El segmento estaba bien identificado, pero el pivot a la marca rompió la confianza construida en el hook.
- **Rewrite pattern**: Eliminar toda referencia al fundador o a la empresa como protagonista. Mantener al propietario como centro absoluto del relato: su miedo, su situación, su alivio. La empresa aparece solo de forma implícita como la solución discreta y sin presión en el CTA final.
- **Segment anchor**: Pre-Foreclosure

### 2026-05-08 — She Inherited Her Mom's Green Bay Home From 3 Hours Away
- **Rejected pattern**: Hashtags included '#RealEstateInvestor' and investor-side language that shifted the frame away from the homeowner's POV and toward the buyer's perspective, undermining the warm, educational tone.
- **Oráculo critique**: Content and segment targeting were strong. The sole rejection trigger was investor-coded hashtag language (#RealEstateInvestor) that broke the homeowner-first voice and risked alienating the distressed inheritor persona.
- **Rewrite pattern**: Removed all investor-coded hashtags and language. Caption and slides stay 100% in the homeowner's emotional frame — loss, distance, overwhelm, and relief — with no terminology that signals Pinnacle's buyer interest.
- **Segment anchor**: Inherited
