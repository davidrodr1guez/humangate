# HumanGate — Pitch Q&A Preparation

## Pregunta 1 / Question 1

**"Tell me in one sentence what this does and why I should care."**

**ES:** "Como developer, cada vez que mi agente de AI necesita tokens de un faucet o acceder a un servicio protegido, se frena por un CAPTCHA y yo tengo que parar lo que estoy haciendo para resolverlo manualmente. HumanGate me deja verificar una vez con World ID, y desde ahí mi agente pasa cualquier gate solo — sin que yo intervenga."

**EN:** "As a developer, every time my AI agent hits a faucet or a protected service, it gets blocked by a CAPTCHA and I have to stop what I'm doing to solve it manually. HumanGate lets me verify once with World ID, and my agent passes every gate autonomously from that point on — no human intervention needed."

---

## Pregunta 2 / Question 2

**"How is this different from just using World Agent Kit directly?"**

**ES:** "Agent Kit maneja pagos x402 — verifica agentes para flujos de micropagos con Coinbase. HumanGate es la capa de whitelist compartido que CUALQUIER servicio puede consultar — faucets, DeFi, APIs, bounties — no solo x402. Agent Kit es una fuente de verificación, HumanGate es donde los servicios van a preguntar. Son complementarios — Agent Kit podría incluso escribir al whitelist de HumanGate."

**EN:** "Agent Kit handles x402 payments — it verifies agents for micropayment flows with Coinbase. HumanGate is the shared whitelist layer that ANY service can query — faucets, DeFi, APIs, bounties — not just x402. Agent Kit is one source of verification, HumanGate is where services go to check. They're complementary — Agent Kit could even write to HumanGate's whitelist."

---

## Pregunta 3 / Question 3

**"Show me the ENS integration working. Can I resolve bob.humanbacked.eth right now?"**

**ES:** "El resolver está deployado en World Chain mainnet. Es resolver Y registry al mismo tiempo — como `on.eth` que Kevin de ENS mostró en el workshop. El nombre resuelve a la address del agente, y los text records son las credenciales verificables — verificado, cuándo, por qué contrato, en qué chain. Todo on-chain, todo consultable ahora mismo. Para que resuelva en MetaMask, necesitaríamos registrar `humanbacked.eth` en L1 y apuntarlo a nuestro resolver. Pero el resolver funciona, los text records están on-chain, y ENSIP-10 wildcard resolution funciona. Si alguien registra el parent name mañana, todos los agentes verificados resuelven automáticamente sin cambios de código."

**EN:** "The resolver is deployed on World Chain mainnet. It's both the resolver AND the registry — like `on.eth` that Kevin from ENS showed in the workshop. The name resolves to the agent's address, and the text records are the verifiable credentials — verified, when, by which contract, on which chain. All on-chain, all queryable right now. For MetaMask resolution, we'd need to register `humanbacked.eth` on L1 and point it to our resolver. But the resolver is live, the text records are on-chain, and ENSIP-10 wildcard resolution works. If someone registers the parent name tomorrow, every verified agent resolves automatically without any code changes."

---

## Pregunta 4 / Question 4

**"You said 'verify once, access everywhere.' But your EIP-712 pass expires in 24 hours."**

**ES:** "El pass es para verificación off-chain — rápido, sin gas. Expira en 24h por seguridad. Pero el registro on-chain — `isVerified()` — nunca expira. Es permanente. Los servicios pueden verificar de las dos formas: el pass para velocidad, o el contrato para permanencia. El agente está en el whitelist para siempre. El pass es una capa de conveniencia. Y el agente puede renovar el pass automáticamente sin el humano — el backend checa on-chain que sigue verificado y firma uno nuevo."

**EN:** "The pass is for off-chain verification — fast, no gas. It expires in 24h for security. But the on-chain record — `isVerified()` — never expires. That's permanent. Services can check either way: the pass for speed, or the contract for permanence. The agent is in the whitelist forever. The pass is just a convenience layer. And the agent can renew the pass automatically without the human — the backend checks on-chain that it's still verified and signs a fresh one."

---

## Pregunta 5 / Question 5

**"Your registerVerified() can only be called by the operator. This is centralized."**

**ES:** "Correcto — el operator es un solo signer hoy. Es un prototipo de hackathon. En producción, sería un multisig o una red de relayers descentralizada. Pero lo importante: el lado de LECTURA es completamente permissionless. Cualquiera puede llamar `isVerified()` sin pasar por nuestro backend. El whitelist es público, on-chain y permanente. La centralización solo está en el lado de ESCRITURA — quién puede agregar agentes. Y hay un segundo path en el contrato, `verifyAgent()`, que hace verificación ZK completamente on-chain sin ningún operator."

**EN:** "You're right — the operator is a single signer today. This is a hackathon prototype. In production, that would be a multisig or a decentralized relayer network. But the important thing is: the READ side is fully permissionless. Anyone can call `isVerified()` without going through our backend. The whitelist is public, on-chain, and permanent. The centralization is only on the WRITE side — who can add agents. And there's a second path in the contract, `verifyAgent()`, that does fully on-chain ZK verification without any operator."

---

## Pregunta 6 / Question 6

**"Every commit says Co-Authored-By Claude. What did YOU actually build?"**

**ES:** "Yo diseñé el producto. Cada decisión arquitectónica fue mía — el modelo de gateway, el whitelist, los passes EIP-712, el naming con ENS. Eso vino de conversaciones con mentores aquí en el evento que me dijeron que lo pensara como un sistema de tickets, como un whitelist compartido, como infraestructura. Pivoté el producto tres veces basándome en ese feedback. Configuré el Developer Portal de World, obtuve las credenciales, fondeé la wallet deployer, probé el flujo completo con mi World App real en mainnet. Asistí a los workshops de World y ENS, extraje los patrones clave. Claude escribió el código. Yo dirigí qué construir, por qué y cómo. Es lo mismo que un arquitecto senior trabajando con un equipo de developers."

**EN:** "I designed the product. Every architectural decision was mine — the gateway model, the whitelist, the EIP-712 passes, the ENS naming. That came from conversations with mentors here at the event who told me to think about it as a ticket system, as a shared whitelist, as infrastructure. I pivoted the product three times based on that feedback. I set up the World Developer Portal, got the credentials, funded the deployer wallet, tested the full flow with my real World App on mainnet. I attended the World and ENS workshops, extracted the key patterns. Claude wrote the code. I directed what to build, why, and how. That's the same as a senior architect working with a team of developers."

---

## Pregunta 7 / Question 7

**"If World ID, ENS, and Agent Kit already exist — what did you actually CREATE that's new?"**

**ES:** "Lo nuevo es la combinación y la interfaz. World ID prueba que eres humano. ENS te da un nombre. Agent Kit maneja pagos. Pero ninguno de ellos responde la pregunta que todo servicio necesita: '¿este agente está respaldado por un humano?' No hay un lugar compartido para hacer esa pregunta. Creamos tres cosas que no existían: Primero, el whitelist compartido — un registro on-chain donde cualquier contrato llama `isVerified()`. Segundo, el resolver que ES el registry — cuando te verificas, automáticamente obtienes una identidad ENS con siete text records como credenciales verificables. Tercero, el pass portátil — una credencial EIP-712 firmada que permite a los agentes probar que son human-backed off-chain en un milisegundo, sin gas. No reinventamos World ID ni ENS. Construimos la capa que faltaba entre ellos y cada servicio que necesita confiar en un agente."

**EN:** "What's new is the combination and the interface. World ID proves you're human. ENS gives you a name. Agent Kit handles payments. But none of them answer the question every service needs: 'is this agent human-backed?' There's no shared place to ask that question. We created three things that didn't exist before: First, the shared whitelist — one on-chain registry where any contract calls `isVerified()`. Second, the resolver that IS the registry — when you verify, you automatically get an ENS identity with seven text records as verifiable credentials. Third, the portable pass — an EIP-712 signed credential that lets agents prove they're human-backed off-chain in one millisecond, no gas, no RPC call. We didn't reinvent World ID or ENS. We built the missing layer between them and every service that needs to trust an agent."

---

## Preguntas extra / Bonus Questions

### "How does it scale?"

**ES:** "Verificar es 2 transacciones, una vez. Consultar es gratis — view call on-chain o ecrecover off-chain. El whitelist es compartido — los servicios no construyen su propia detección de bots. Más agentes = más txs en World Chain = más actividad orgánica."

**EN:** "Verifying is 2 transactions, once. Checking is free — view call on-chain or ecrecover off-chain. The whitelist is shared — services don't build their own bot detection. More agents = more txs on World Chain = more organic activity."

### "What's the business model?"

**ES:** "Registrar un agente cuesta gas — 2 transacciones en World Chain, menos de un centavo. Consultar si un agente es human-backed es gratis para siempre. En el futuro: tiers premium con analytics, revocación, y bulk registration."

**EN:** "Registering an agent costs gas — 2 transactions on World Chain, less than a cent. Checking if an agent is human-backed is free forever. Future: premium tiers with analytics, revocation, and bulk registration."

### "What was the hardest technical challenge?"

**ES:** "IDKit v4 cambió el encoding del signal hash, así que el ZK proof no pasaba verificación on-chain. El WorldID Router devolvía ProofInvalid. Descubrimos que IDKit hashea la signal como string (42 bytes) pero el contrato la hashea como address (20 bytes). La solución: verificamos via la Cloud API de World y registramos on-chain con una segunda función. El contrato mantiene ambos paths — on-chain ZK y cloud-verified."

**EN:** "IDKit v4 changed the signal hash encoding, so the ZK proof wouldn't pass on-chain verification. The WorldID Router returned ProofInvalid. We discovered IDKit hashes the signal as a string (42 bytes) but the contract hashes it as an address (20 bytes). The solution: we verify via World's Cloud API and register on-chain with a second function. The contract keeps both paths — on-chain ZK and cloud-verified."

### "Why ENS and not just a mapping?"

**ES:** "`isVerified()` solo responde sí o no. ENS responde quién, cuándo, dónde, y cómo. Los text records son credenciales verificables públicas — otro agente puede resolver el nombre y saber todo sobre ese agente sin llamar a nuestra API. Es la diferencia entre un bouncer que dice 'sí puede pasar' y un bouncer que dice 'tiene credencial verificada el 4 de abril por HumanGate en World Chain, se llama bob'."

**EN:** "`isVerified()` only answers yes or no. ENS answers who, when, where, and how. The text records are public verifiable credentials — another agent can resolve the name and know everything about that agent without calling our API. It's the difference between a bouncer who says 'you can enter' and a bouncer who says 'verified credential from April 4th by HumanGate on World Chain, name is bob'."

---

## Reglas del pitch / Pitch Rules

1. Empieza con el dolor, no con la tecnología
2. Complementas Agent Kit, no compites
3. Acepta limitaciones — centralización, ENS no resuelve en MetaMask, pass expira
4. Redirige a lo que SÍ funciona — deployed en mainnet, datos live, 16 tests
5. Tú eres el arquitecto, Claude es la herramienta
6. Lo nuevo es la combinación + la interfaz universal
