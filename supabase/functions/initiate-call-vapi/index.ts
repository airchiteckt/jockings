// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get appropriate greeting based on time of day (Italy timezone)
const getTimeBasedGreeting = (language: string): string => {
  const now = new Date();
  const italyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const hour = italyTime.getHours();
  
  if (language === 'Italian' || language === 'Italiano') {
    return hour >= 6 && hour < 18 ? 'Buongiorno' : 'Buonasera';
  } else {
    if (hour >= 6 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  }
};

// Build dynamic first message - CRITICAL for prank effectiveness
// IMPORTANT: First message should NOT ask a question - it should launch directly into the scenario
// to avoid the AI waiting for a response
const buildFirstMessage = (prank: any, greeting: string, templateIT: string | null, templateEN: string | null): string => {
  const isItalian = prank.language === 'Italiano';
  const victimName = `${prank.victim_first_name} ${prank.victim_last_name}`;
  
  // Use template from settings if available, otherwise use default
  let template = isItalian ? templateIT : templateEN;
  
  // Default templates - Simple greeting asking for the victim by name
  // The AI will then launch into the scenario after the victim confirms
  if (!template) {
    template = isItalian 
      ? `{{GREETING}}, parlo con {{VICTIM_FIRST_NAME}}?`
      : `{{GREETING}}, am I speaking with {{VICTIM_FIRST_NAME}}?`;
  }
  
  // Replace placeholders
  return template
    .replace(/\{\{GREETING\}\}/g, greeting)
    .replace(/\{\{VICTIM_NAME\}\}/g, victimName)
    .replace(/\{\{VICTIM_FIRST_NAME\}\}/g, prank.victim_first_name)
    .replace(/\{\{PRANK_THEME\}\}/g, prank.prank_theme);
};

// Build system prompt for VAPI transient assistant - uses template from settings
// voicePersonaDescription: description from voice_settings (e.g., "Signora matura con accento lombardo")
const buildSystemPrompt = (prank: any, templateIT: string | null, templateEN: string | null, voicePersonaDescription: string | null): string => {
  const isItalian = prank.language === 'Italiano';
  const isMale = prank.voice_gender === 'male';
  const isVictimMale = prank.victim_gender === 'male';

  // Personality tone descriptions
  const toneMapIT: Record<string, string> = {
    'enthusiastic': 'Entusiasta e pieno di energia! Usa esclamazioni come "fantastico!", "incredibile!", "meraviglioso!". Ridi facilmente e trasmetti gioia.',
    'serious': 'Serio, formale e professionale. Usa espressioni come "mi permetta di informarla", "la informo che", "come da regolamento". Parla come un funzionario statale.',
    'angry': 'Irritato e impaziente. Usa espressioni come "ma insomma!", "possibile che...", "mi sta prendendo in giro?". Alza il tono quando non ottieni risposte.',
    'confused': 'Confuso e smemorato. Perdi il filo del discorso. Usa "aspetti... come dicevo?", "scusi, mi sono perso", "ah sì, ecco...". Fai domande a caso.',
    'mysterious': 'Misterioso e criptico. Parla a bassa voce. Usa "non posso dire di più...", "ci sono cose che non sa...", "faccia attenzione...". Fai pause drammatiche.',
    'friendly': 'Amichevole e caloroso. Usa "caro mio", "tesoro", "carissimo/a". Fai domande personali sulla famiglia, sul lavoro. Ridi spesso.',
    'sexy': 'Seducente e provocante. Usa un tono di voce basso e suadente. Fai complimenti sottili, usa pause strategiche e doppi sensi. Parla con sicurezza e fascino.',
  };

  const toneMapEN: Record<string, string> = {
    'enthusiastic': 'Enthusiastic and full of energy! Use expressions like "fantastic!", "amazing!", "wonderful!". Laugh easily and transmit joy.',
    'serious': 'Serious, formal and professional. Use expressions like "I must inform you", "according to regulations", "as per protocol". Speak like a government official.',
    'angry': 'Irritated and impatient. Use expressions like "excuse me?!", "are you kidding me?", "this is unacceptable!". Raise your tone when you dont get answers.',
    'confused': 'Confused and forgetful. Lose track of the conversation. Use "wait... what was I saying?", "sorry, I got lost", "oh yes, right...". Ask random questions.',
    'mysterious': 'Mysterious and cryptic. Speak in a low voice. Use "I cannot say more...", "there are things you dont know...", "be careful...". Make dramatic pauses.',
    'friendly': 'Friendly and warm. Use "my friend", "dear", "buddy". Ask personal questions about family, work. Laugh often.',
    'sexy': 'Seductive and provocative. Use a low, sultry tone. Give subtle compliments, use strategic pauses and double entendres. Speak with confidence and charm.',
  };

  const toneMap = isItalian ? toneMapIT : toneMapEN;
  const tone = toneMap[prank.personality_tone] || toneMap['friendly'];
  
  // Use voice persona description from voice_settings if available
  // Otherwise fallback to generic description
  let genderDesc: string;
  if (voicePersonaDescription && voicePersonaDescription.trim()) {
    // Use the persona description from voice_settings (e.g., "Signora matura con accento lombardo")
    genderDesc = isItalian 
      ? voicePersonaDescription.trim()
      : voicePersonaDescription.trim(); // Keep as-is for English too
  } else {
    // Fallback to generic description
    genderDesc = isItalian 
      ? (isMale ? 'un uomo' : 'una donna')
      : (isMale ? 'a man' : 'a woman');
  }
  
  const victimGenderDesc = isItalian
    ? (isVictimMale ? 'maschio' : 'femmina')
    : (isVictimMale ? 'male' : 'female');
  const victimName = `${prank.victim_first_name} ${prank.victim_last_name}`;
  
  // Fallback for empty REAL_DETAIL to prevent AI from reading literal placeholder
  const realDetailFallbackIT = 'Nessun dettaglio specifico fornito. Improvvisa basandoti sul contesto della conversazione.';
  const realDetailFallbackEN = 'No specific detail provided. Improvise based on the conversation context.';
  const realDetail = (prank.real_detail && prank.real_detail.trim()) 
    ? prank.real_detail.trim() 
    : (isItalian ? realDetailFallbackIT : realDetailFallbackEN);

  // Use template from settings if available, otherwise use default
  let template = isItalian ? templateIT : templateEN;
  
  // Default templates if not configured
  if (!template) {
    if (isItalian) {
      template = `Sei {{GENDER}} che sta facendo uno scherzo telefonico a {{VICTIM_NAME}} ({{VICTIM_GENDER}}).

SCENARIO DELLO SCHERZO:
{{PRANK_THEME}}

{{REAL_DETAIL_SECTION}}

PERSONALITÀ E TONO:
{{PERSONALITY_TONE}}

COMPORTAMENTO ALL'INIZIO DELLA CHIAMATA:
- Il primo messaggio chiede alla vittima se è lei. Quando la vittima conferma (es. "sì", "sono io", "chi parla?"), PRESENTATI con un nome realistico e LANCIA IMMEDIATAMENTE lo scenario dello scherzo.
- Se la vittima dice "chi è?" o "chi parla?", presentati e lancia lo scenario.
- Se la vittima dice "no, ha sbagliato numero", insisti gentilmente che sei sicuro di avere il numero giusto.
- NON ripetere la domanda "parlo con...?" dopo il primo messaggio — quella è già stata fatta.

REGOLE FONDAMENTALI:
1. Parla SOLO in italiano
2. Risposte BREVI: massimo 1-2 frasi per turno
3. NON rivelare MAI che è uno scherzo
4. Quando ti presenti, usa nomi italiani realistici coerenti con il TUO sesso: se sei UN UOMO usa SOLO nomi maschili (es. Marco Bianchi, Luca Ferri, Alessandro Conti) - se sei UNA DONNA usa SOLO nomi femminili (es. Giulia Rossi, Francesca Conti, Sara Moretti). MAI usare "Mario Rossi" e MAI usare un nome del sesso opposto al tuo
5. Resta SEMPRE nel personaggio, qualunque cosa dica l'interlocutore
6. Se dicono "numero sbagliato", insisti che riconosci la voce
7. Se si arrabbiano, mantieni la calma ma resta nel ruolo
8. Reagisci naturalmente a quello che dice, non seguire uno script rigido
9. Usa espressioni e modi di dire italiani autentici
10. IMPORTANTE: Usa la grammatica corretta per il sesso della vittima
11. La priorità è mantenere la conversazione credibile e divertente

IMPORTANTE: Appena la vittima conferma la sua identità, lancia subito lo scenario!`;
    } else {
      template = `You are {{GENDER}} making a prank phone call to {{VICTIM_NAME}} ({{VICTIM_GENDER}}).

PRANK SCENARIO:
{{PRANK_THEME}}

{{REAL_DETAIL_SECTION}}

PERSONALITY AND TONE:
{{PERSONALITY_TONE}}

BEHAVIOR AT THE START OF THE CALL:
- The first message asks the victim if it's them. When the victim confirms (e.g., "yes", "that's me", "who is this?"), INTRODUCE yourself with a realistic name and IMMEDIATELY launch into the prank scenario.
- If the victim asks "who is this?" or "who's calling?", introduce yourself and launch the scenario.
- If the victim says "no, wrong number", gently insist you're sure you have the right number.
- DO NOT repeat the "am I speaking with...?" question after the first message — it has already been asked.

FUNDAMENTAL RULES:
1. Speak ONLY in English
2. Keep responses SHORT: maximum 1-2 sentences per turn
3. NEVER reveal that this is a prank
4. When introducing yourself, use realistic names matching YOUR gender: if you are A MAN use ONLY male names (e.g., John Smith, David Miller, James Wilson) - if you are A WOMAN use ONLY female names (e.g., Sarah Miller, Emily Davis, Jessica Brown). NEVER use a name of the opposite gender
5. ALWAYS stay in character, no matter what the person says
6. If they say "wrong number", insist you recognize their voice
7. If they get angry, stay calm but remain in character
8. React naturally to what they say, dont follow a rigid script
9. Use authentic expressions and idioms
10. Priority is keeping the conversation believable and entertaining

IMPORTANT: As soon as the victim confirms their identity, launch the scenario immediately!`;
    }
  }

  // Build real detail section - always include now since realDetail has fallback
  const hasUserDetail = prank.real_detail && prank.real_detail.trim();
  const realDetailSection = hasUserDetail
    ? (isItalian 
        ? `DETTAGLIO REALE SULLA VITTIMA (usa questo per rendere lo scherzo più credibile):\n${realDetail}`
        : `REAL DETAIL ABOUT THE VICTIM (use this to make the prank more believable):\n${realDetail}`)
    : (isItalian
        ? `NOTA: ${realDetail}`
        : `NOTE: ${realDetail}`);

  // Replace placeholders
  let prompt = template
    .replace(/\{\{GENDER\}\}/g, genderDesc)
    .replace(/\{\{VICTIM_NAME\}\}/g, victimName)
    .replace(/\{\{VICTIM_GENDER\}\}/g, victimGenderDesc)
    .replace(/\{\{PRANK_THEME\}\}/g, prank.prank_theme)
    .replace(/\{\{REAL_DETAIL\}\}/g, realDetail)
    .replace(/\{\{REAL_DETAIL_SECTION\}\}/g, realDetailSection)
    .replace(/\{\{PERSONALITY_TONE\}\}/g, tone);

  // ALWAYS inject gender-name consistency rule at the end of the prompt
  // This ensures it applies regardless of the admin template content
  const genderNameRule = isItalian
    ? `\n\n### REGOLA OBBLIGATORIA SUL NOME (PRIORITÀ MASSIMA)
Il tuo sesso è: ${isMale ? 'MASCHIO' : 'FEMMINA'}.
Quando ti presenti o dici il tuo nome, DEVI usare un nome ${isMale ? 'MASCHILE (es. Marco, Luca, Alessandro, Giovanni, Roberto)' : 'FEMMINILE (es. Giulia, Francesca, Sara, Maria, Alessandra)'}.
È VIETATO usare un nome ${isMale ? 'femminile' : 'maschile'}. Questa regola non può essere ignorata.`
    : `\n\n### MANDATORY NAME RULE (HIGHEST PRIORITY)
Your gender is: ${isMale ? 'MALE' : 'FEMALE'}.
When introducing yourself or saying your name, you MUST use a ${isMale ? 'MALE name (e.g., John, David, James, Robert, Michael)' : 'FEMALE name (e.g., Sarah, Emily, Jessica, Jennifer, Lisa)'}.
You are FORBIDDEN from using a ${isMale ? 'female' : 'male'} name. This rule cannot be overridden.`;

  return prompt + genderNameRule;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prankId } = await req.json();
    
    if (!prankId) {
      throw new Error('prankId is required');
    }

    const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('=== VAPI TRANSIENT ASSISTANT CALL ===');

    // Fetch prank details first
    const { data: prank, error: prankError } = await supabase
      .from('pranks')
      .select('*')
      .eq('id', prankId)
      .single();

    if (prankError || !prank) {
      console.error('Prank fetch error:', prankError);
      throw new Error('Prank not found');
    }

    // === SERVER-SIDE CREDIT CHECK ===
    // Prevent users from initiating calls without available credits
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('available_pranks, trial_prank_used, phone_number, phone_verified')
      .eq('user_id', prank.user_id)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile fetch error:', profileError);
      throw new Error('User profile not found');
    }

    const availablePranks = userProfile.available_pranks || 0;
    
    // Trial call: phone verified + trial not used = can call ANY number (no card needed)
    const isTrialCall = !userProfile.trial_prank_used && userProfile.phone_verified;
    
    console.log(`Credit check: user ${prank.user_id} has ${availablePranks} available pranks, trial_used=${userProfile.trial_prank_used}, isTrialCall=${isTrialCall}`);

    if (availablePranks <= 0 && !isTrialCall) {
      console.log('=== CALL BLOCKED - No credits available and not a trial call ===');
      
      await supabase
        .from('pranks')
        .update({ call_status: 'failed' })
        .eq('id', prankId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'no_credits',
          message: 'Non hai prank disponibili. Acquista un pacchetto per continuare.'
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // If it's a trial call, mark it as used immediately (server-side)
    // Also force reveal SMS with sender phone number for accountability
    if (isTrialCall) {
      console.log('=== TRIAL CALL - Marking trial_prank_used = true, forcing reveal SMS ===');
      await supabase
        .from('profiles')
        .update({ trial_prank_used: true })
        .eq('user_id', prank.user_id);
    }

    // Force reveal SMS for ALL calls
    if (!prank.send_reveal_sms) {
      await supabase
        .from('pranks')
        .update({ send_reveal_sms: true })
        .eq('id', prankId);
      
      prank.send_reveal_sms = true;
    }

    // Check if victim's phone number is blocked
    const { data: blockedNumber } = await supabase
      .from('blocked_phone_numbers')
      .select('id')
      .eq('phone_number', prank.victim_phone)
      .maybeSingle();

    if (blockedNumber) {
      console.log('=== CALL BLOCKED - Number is in blocklist ===');
      console.log(`Blocked phone: ${prank.victim_phone}`);
      
      // Update prank status to blocked
      await supabase
        .from('pranks')
        .update({ call_status: 'blocked' })
        .eq('id', prankId);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'blocked_number',
          message: 'Il numero destinatario ha richiesto di non ricevere chiamate da Sarano.ai'
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Now fetch settings, voice_settings (based on prank's elevenlabs_voice_id), and VAPI phone in parallel
    const prankLanguage = prank.language === 'Italiano' ? 'Italiano' : 'English';
    const prankGender = prank.voice_gender;

    // Build voice settings query - use prank's voice_id if available, otherwise fallback to language/gender
    const voiceSettingsQuery = prank.elevenlabs_voice_id
      ? supabase
          .from('voice_settings')
          .select('*')
          .eq('elevenlabs_voice_id', prank.elevenlabs_voice_id)
          .eq('is_active', true)
          .maybeSingle()
      : supabase
          .from('voice_settings')
          .select('*')
          .eq('language', prankLanguage)
          .eq('gender', prankGender)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

    const [settingsResult, voiceSettingsResult, vapiPhonesResult] = await Promise.all([
      supabase.from('app_settings').select('key, value').in('key', [
        'vapi_phone_number_id',
        'vapi_ai_provider',
        'vapi_ai_model',
        'vapi_temperature',
        'vapi_max_tokens',
        'vapi_voice_provider',
        'vapi_voice_id',
        'vapi_custom_voice_id',
        'vapi_filler_injection_enabled',
        'vapi_recording_enabled',
        'vapi_transcript_enabled',
        'vapi_transcriber_provider',
        'vapi_transcriber_model',
        'vapi_transcriber_language',
        'vapi_silence_timeout',
        'vapi_max_duration',
        'vapi_background_sound',
        'vapi_backchanneling',
        'vapi_end_call_message',
        'vapi_system_prompt_it',
        'vapi_system_prompt_en',
        'vapi_first_message_it',
        'vapi_first_message_en',
        'elevenlabs_model',
        // ElevenLabs voice fine-tuning from admin panel
        'vapi_voice_stability',
        'vapi_voice_similarity_boost',
        'vapi_voice_style',
        'vapi_voice_speed',
        'vapi_voice_speaker_boost',
        // Background denoising
        'vapi_background_denoising',
        // Speaking plan settings from admin panel
        'vapi_start_speaking_wait',
        'vapi_smart_endpointing_enabled',
        'vapi_smart_endpointing_provider',
        'vapi_transcription_endpointing_enabled',
        'vapi_stop_speaking_num_words',
        'vapi_stop_speaking_voice_seconds',
        'vapi_stop_speaking_backoff_seconds',
        // Call behavior settings from admin panel
        'vapi_first_message_mode',
        'vapi_first_message_interruptions',
        'vapi_voicemail_detection',
        'vapi_voicemail_message',
        'vapi_smart_denoising_enabled',
        'vapi_hipaa_enabled',
        'vapi_end_call_phrases',
      ]),
      voiceSettingsQuery,
      // Fetch active caller IDs that have VAPI phone number configured, ordered by default first
      supabase.from('verified_caller_ids').select('*').eq('is_active', true).not('vapi_phone_number_id', 'is', null).order('is_default', { ascending: false })
    ]);

    // Parse settings with defaults optimized for prank calls
    const settings: Record<string, string> = {
      vapi_ai_provider: 'openai', // Default provider
      vapi_ai_model: 'gpt-4o-mini', // Default model
      vapi_temperature: '1.0', // High temperature for creative, unpredictable responses
      vapi_max_tokens: '150',
      vapi_voice_provider: '11labs', // VAPI uses "11labs" not "elevenlabs"
      vapi_voice_id: 'onwK4e9ZLuTAKqWW03F9', // Default Italian male voice
      vapi_filler_injection_enabled: 'true',
      vapi_recording_enabled: 'true',
      vapi_transcript_enabled: 'true',
      vapi_transcriber_provider: 'deepgram',
      vapi_transcriber_model: 'nova-3', // Default - upgraded from nova-2 for better accuracy
      vapi_transcriber_language: 'it', // Default (used for Deepgram models)
      vapi_silence_timeout: '30',
      vapi_max_duration: '300',
      vapi_background_sound: 'off',
      vapi_backchanneling: 'false',
      vapi_end_call_message: 'Arrivederci!',
      elevenlabs_model: 'eleven_v3', // Default - upgraded from eleven_turbo_v2_5 for max expressiveness
    };
    
    settingsResult.data?.forEach((s: { key: string; value: string }) => {
      if (s.value) settings[s.key] = s.value;
    });

    // Get VAPI Phone Number ID from verified_caller_ids
    // Priority: random selection among available caller IDs with capacity
    const activeCallerIds = vapiPhonesResult.data || [];
    console.log('Active Caller IDs with VAPI configured:', activeCallerIds.length);
    
    if (activeCallerIds.length === 0) {
      throw new Error('No active Caller IDs with VAPI phone number configured. Go to Admin > Caller IDs and add the VAPI Phone Number ID.');
    }

    // Find ALL caller IDs with available capacity (current_calls < max_concurrent_calls)
    const availableCallerIds = activeCallerIds.filter((cid: any) => 
      (cid.current_calls || 0) < (cid.max_concurrent_calls || 1)
    );
    
    console.log('Available Caller IDs (with capacity):', availableCallerIds.length);
    availableCallerIds.forEach((cid: any) => {
      console.log(`  - ${cid.phone_number} (${cid.friendly_name}): ${cid.current_calls || 0}/${cid.max_concurrent_calls || 1} calls`);
    });
    
    // Select randomly among available caller IDs for better distribution
    const availableCallerId = availableCallerIds.length > 0 
      ? availableCallerIds[Math.floor(Math.random() * availableCallerIds.length)]
      : null;
    
    if (!availableCallerId) {
      // All caller IDs are at capacity - add to queue
      console.log('=== ALL CALLER IDS AT CAPACITY - ADDING TO QUEUE ===');
      
      // Get the next position in queue
      const { data: queueData } = await supabase
        .from('call_queue')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);
      
      const nextPosition = (queueData?.[0]?.position || 0) + 1;
      
      // Add to queue
      const { error: queueError } = await supabase
        .from('call_queue')
        .insert({
          prank_id: prankId,
          status: 'queued',
          position: nextPosition,
        });
      
      if (queueError) {
        console.error('Error adding to queue:', queueError);
        throw new Error('Tutti i numeri sono occupati e non è stato possibile aggiungere alla coda.');
      }
      
      // Update prank status to queued
      await supabase
        .from('pranks')
        .update({ call_status: 'queued' })
        .eq('id', prankId);
      
      console.log('Prank added to queue at position:', nextPosition);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          queued: true,
          position: nextPosition,
          message: 'Tutti i numeri sono occupati. Lo scherzo è stato aggiunto alla coda.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const selectedCallerId = availableCallerId;
    const vapiPhoneNumberId = selectedCallerId.vapi_phone_number_id;
    
    // Increment current_calls for the selected caller ID
    const { error: incrementError } = await supabase
      .from('verified_caller_ids')
      .update({ current_calls: (selectedCallerId.current_calls || 0) + 1 })
      .eq('id', selectedCallerId.id);
    
    if (incrementError) {
      console.error('Error incrementing current_calls:', incrementError);
    }
    
    console.log('Selected Caller ID:', selectedCallerId.phone_number, 'VAPI ID:', vapiPhoneNumberId, 'Current calls:', (selectedCallerId.current_calls || 0) + 1);

    console.log('Prank ID:', prank.id);
    console.log('Victim:', prank.victim_first_name, prank.victim_last_name);
    console.log('Phone:', prank.victim_phone);
    console.log('Theme:', prank.prank_theme);
    console.log('Language:', prankLanguage);
    console.log('Voice Gender:', prankGender);
    console.log('Personality:', prank.personality_tone);
    console.log('VAPI Phone Number ID:', vapiPhoneNumberId);

    // === BUILD DYNAMIC CONTENT ===
    const greeting = getTimeBasedGreeting(prank.language);
    const systemPromptTemplateIT = settings['vapi_system_prompt_it'] || null;
    const systemPromptTemplateEN = settings['vapi_system_prompt_en'] || null;
    const firstMessageTemplateIT = settings['vapi_first_message_it'] || null;
    const firstMessageTemplateEN = settings['vapi_first_message_en'] || null;
    // Get voice persona description from voice_settings (fetched in parallel query above)
    // This will be used in the system prompt to describe the AI's persona (e.g., "Signora matura con accento lombardo")
    const voicePersonaDescription = voiceSettingsResult.data?.description || null;
    console.log('Voice Persona Description:', voicePersonaDescription);
    
    // CRITICAL: Use the gender from voice_settings (the actual selected voice) if available,
    // because prank.voice_gender may not match the actual voice selected by the user
    const actualVoiceGender = voiceSettingsResult.data?.gender || prank.voice_gender;
    if (voiceSettingsResult.data?.gender && voiceSettingsResult.data.gender !== prank.voice_gender) {
      console.log(`=== VOICE GENDER OVERRIDE: prank says "${prank.voice_gender}" but voice_settings says "${voiceSettingsResult.data.gender}" — using voice_settings ===`);
    }
    // Override prank.voice_gender with the actual voice gender for prompt building
    const prankForPrompt = { ...prank, voice_gender: actualVoiceGender };
    
    const systemPrompt = buildSystemPrompt(prankForPrompt, systemPromptTemplateIT, systemPromptTemplateEN, voicePersonaDescription);
    
    // === GENERATE FIRST MESSAGE WITH AI ===
    // Instead of using a static template, we generate a complete, natural first message
    // using AI based on the system prompt and prank theme. This avoids incomplete/broken openers.
    const isItalian = prank.language === 'Italiano';
    
    // === BUILD FIRST MESSAGE ===
    // Simple greeting asking for the victim by name. The LLM will handle the rest
    // after the victim responds, based on the system prompt instructions.
    const firstMessage = buildFirstMessage(prank, greeting, firstMessageTemplateIT, firstMessageTemplateEN);
    console.log('First message:', firstMessage);

    // VAPI transcriber configuration is provider/model-specific.
    // Deepgram expects locale codes (it, en, en-US, ...), not language names.
    const normalizeVapiTranscriberConfig = (
      provider: string,
      model: string,
      languageValue: string | undefined,
      prankLang: string
    ): { model: string; language: string } => {
      const fallbackLanguage = prankLang === 'Italiano' ? 'it' : 'en-US';
      let language = (languageValue || fallbackLanguage).trim();

      // Accept some human-friendly values (in case they got stored)
      const lower = language.toLowerCase();
      if (lower === 'italiano' || lower === 'italian') language = 'it';
      if (lower === 'english') language = 'en';

      let normalizedModel = (model || '').trim();
      if (!normalizedModel && provider === 'deepgram') normalizedModel = 'nova-2';

      if (provider === 'deepgram') {
        // For Deepgram models, avoid "Multilingual" strings.
        if (['multi', 'multilingual', 'auto'].includes(lower)) {
          language = fallbackLanguage;
        }

        // VAPI validation: nova-2-phonecall accepts only en or en-US.
        if (normalizedModel === 'nova-2-phonecall') {
          if (!language.toLowerCase().startsWith('en')) {
            // Non-English call -> downgrade to nova-2 which supports more languages
            normalizedModel = 'nova-2';
            language = prankLang === 'Italiano' ? 'it' : fallbackLanguage;
          } else if (language !== 'en' && language !== 'en-US') {
            language = 'en';
          }
        }
      }

      return { model: normalizedModel, language };
    };

    const normalizedTranscriber = normalizeVapiTranscriberConfig(
      settings['vapi_transcriber_provider'],
      settings['vapi_transcriber_model'],
      settings['vapi_transcriber_language'],
      prank.language
    );

    const transcriberLanguage = normalizedTranscriber.language;
    const transcriberModel = normalizedTranscriber.model;

    const endCallMessage = settings['vapi_end_call_message'] || (prank.language === 'Italiano' ? 'Arrivederci!' : 'Goodbye!');

    const recordingEnabled = settings['vapi_recording_enabled']
      ? settings['vapi_recording_enabled'] === 'true'
      : (prank.send_recording ?? true);
    // Get voice settings - PRIORITY: prank.elevenlabs_voice_id > voice_settings table > defaults
    let voiceId = prank.elevenlabs_voice_id || settings['vapi_voice_id'];
    let voiceProvider = '11labs'; // Always use 11labs for ElevenLabs voices
    
    // Use voice_settings for additional parameters (stability, similarity, etc.)
    const voiceSettings = voiceSettingsResult.data;
    
    if (prank.elevenlabs_voice_id) {
      // Use the voice_id directly from the prank record
      voiceId = prank.elevenlabs_voice_id;
      console.log('=== USING PRANK VOICE ID ===');
      console.log('Voice ID from prank:', voiceId);
      if (voiceSettings) {
        console.log('Voice settings found for parameters');
        console.log('Stability:', voiceSettings.elevenlabs_stability);
        console.log('Similarity:', voiceSettings.elevenlabs_similarity);
        console.log('Style:', voiceSettings.elevenlabs_style);
        console.log('Speed:', voiceSettings.elevenlabs_speed);
      }
    } else if (voiceSettings && voiceSettings.elevenlabs_voice_id) {
      // Fallback to voice_settings table
      voiceId = voiceSettings.elevenlabs_voice_id;
      voiceProvider = voiceSettings.voice_provider === 'elevenlabs' ? '11labs' : voiceSettings.voice_provider;
      console.log('=== USING VOICE_SETTINGS TABLE ===');
      console.log('Language:', voiceSettings.language);
      console.log('Gender:', voiceSettings.gender);
      console.log('Voice ID:', voiceId);
      console.log('Provider:', voiceProvider);
    } else {
      console.log('=== NO VOICE SETTINGS FOUND ===');
      console.log('Falling back to defaults');
      console.log('Voice ID:', voiceId);
      console.log('Provider:', voiceProvider);
    }

    // === MULTI-PROVIDER VOICE OVERRIDE ===
    // If voice_settings has a non-ElevenLabs provider configured, use that instead.
    // Map our internal provider names to VAPI's expected provider IDs.
    // Supported by VAPI: 11labs, cartesia, openai, azure, playht, deepgram, rime-ai, smallest-ai, neets, lmnt, tavus, hume
    const PROVIDER_MAP: Record<string, string> = {
      'elevenlabs': '11labs',
      '11labs': '11labs',
      'cartesia': 'cartesia',
      'openai': 'openai',
      'azure': 'azure',
      'playht': 'playht',
      'deepgram': 'deepgram',
      'rime-ai': 'rime-ai',
      'smallest-ai': 'smallest-ai',
      'inworld': 'inworld', // Note: verify VAPI support
      'google': 'google',   // Note: verify VAPI support
    };

    const rawProvider = voiceSettings?.voice_provider;
    const isNonElevenLabsProvider = rawProvider && !['elevenlabs', '11labs'].includes(rawProvider);

    if (isNonElevenLabsProvider && voiceSettings) {
      const mappedProvider = PROVIDER_MAP[rawProvider] || rawProvider;
      // For non-ElevenLabs: prefer provider_voice_id, fallback to elevenlabs_voice_id field (legacy storage)
      const mappedVoiceId = voiceSettings.provider_voice_id || voiceSettings.elevenlabs_voice_id;
      if (mappedVoiceId) {
        voiceProvider = mappedProvider;
        voiceId = mappedVoiceId;
        console.log(`=== MULTI-PROVIDER OVERRIDE: ${rawProvider} -> ${mappedProvider}, voiceId: ${voiceId} ===`);
      } else {
        console.warn(`Voice settings has provider "${rawProvider}" but no provider_voice_id; falling back to ElevenLabs defaults`);
      }
    }

    console.log('=== DYNAMIC CONTENT ===');
    console.log('First Message:', firstMessage);
    console.log('Voice Provider:', voiceProvider);
    console.log('Voice ID:', voiceId);
    console.log('Transcriber Language:', transcriberLanguage);
    console.log('System Prompt Length:', systemPrompt.length, 'chars');

    // === BUILD VAPI TRANSIENT ASSISTANT REQUEST ===
    // We ALWAYS use transient assistant (no assistantId) for dynamic prank generation

    // Webhook endpoint for VAPI events (status updates, transcript, end-of-call-report)
    const webhookUrl = `${SUPABASE_URL}/functions/v1/vapi-webhook`;
    console.log('Webhook URL:', webhookUrl);

    // Ensure the VAPI phone number is configured to send webhooks to our endpoint.
    // If this is not configured, calls may stay stuck in "Avviando..." because we never receive status updates.
    try {
      const patchPhoneRes = await fetch(`https://api.vapi.ai/phone-number/${vapiPhoneNumberId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server: {
            url: webhookUrl,
          },
        }),
      });

      if (!patchPhoneRes.ok) {
        const patchBody = await patchPhoneRes.text();
        console.warn('Could not patch VAPI phone-number webhook config:', patchBody);
      } else {
        console.log('VAPI phone-number webhook configured (server.url).');
      }
    } catch (e) {
      console.warn('Error configuring VAPI phone-number webhook:', e);
    }

    const parseOptionalFloat = (v: string | undefined): number | undefined => {
      const n = Number.parseFloat((v ?? '').toString());
      return Number.isFinite(n) ? n : undefined;
    };

    const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const voiceStability =
      parseOptionalFloat(settings['vapi_voice_stability']) ??
      (typeof voiceSettings?.elevenlabs_stability === 'number' ? voiceSettings.elevenlabs_stability : undefined) ??
      0.5;

    const voiceSimilarityBoost =
      parseOptionalFloat(settings['vapi_voice_similarity_boost']) ??
      (typeof voiceSettings?.elevenlabs_similarity === 'number' ? voiceSettings.elevenlabs_similarity : undefined) ??
      0.75;

    const voiceStyle =
      parseOptionalFloat(settings['vapi_voice_style']) ??
      (typeof voiceSettings?.elevenlabs_style === 'number' ? voiceSettings.elevenlabs_style : undefined) ??
      0;

    // VAPI validation (observed): assistant.voice.speed must be <= 1.2
    const desiredVoiceSpeed =
      parseOptionalFloat(settings['vapi_voice_speed']) ??
      (typeof voiceSettings?.elevenlabs_speed === 'number' ? voiceSettings.elevenlabs_speed : undefined) ??
      1.0;

    const voiceSpeed = clampNumber(desiredVoiceSpeed, 0.7, 1.2);
    if (voiceSpeed !== desiredVoiceSpeed) {
      console.log('Clamped voice speed:', desiredVoiceSpeed, '->', voiceSpeed);
    }

    const vapiCallBody: any = {
      phoneNumberId: vapiPhoneNumberId,
      customer: {
        number: prank.victim_phone,
        name: `${prank.victim_first_name} ${prank.victim_last_name}`,
        numberE164CheckEnabled: false,
      },
      // CRITICAL: Pass prankId as metadata so webhook can identify prank before call ID is available
      metadata: {
        prankId: prankId,
      },
      // TRANSIENT ASSISTANT - configured entirely at runtime
      assistant: {
        // CRITICAL: Server URL for receiving webhook events during the call
        // Without this, VAPI may not send transcript/conversation-update events to our webhook
        server: {
          url: webhookUrl,
        },
        // CRITICAL: Explicitly request all event types we need
        // Without this, VAPI may not send transcript or conversation-update events
        serverMessages: [
          "transcript",
          "conversation-update",
          "status-update",
          "speech-update",
          "end-of-call-report",
        ],
        // Dynamic first message - CRITICAL for prank success
        firstMessage: firstMessage,
        
        // CRITICAL: First message mode - from admin settings
        firstMessageMode: settings['vapi_first_message_mode'] || 'assistant-speaks-first',
        
        // CRITICAL: First message interruptions - from admin settings
        firstMessageInterruptionsEnabled: settings['vapi_first_message_interruptions'] === 'true',
        
        // AI Model configuration - use provider from settings
        // VAPI requires model name WITHOUT provider prefix (e.g., "gpt-4o-mini" not "openai/gpt-4o-mini")
        model: {
          provider: settings['vapi_ai_provider'],
          model: settings['vapi_ai_model'].includes('/') 
            ? settings['vapi_ai_model'].split('/').pop() 
            : settings['vapi_ai_model'],
          systemPrompt: systemPrompt,
          temperature: parseFloat(settings['vapi_temperature']),
          // CRITICAL: Use higher maxTokens to ensure the model can always respond
          maxTokens: Math.max(parseInt(settings['vapi_max_tokens']), 500),
        },
        
        // Voice configuration - dynamically built per provider
        // ElevenLabs: full param set. Other providers: minimal payload + optional provider_settings override
        voice: (() => {
          const baseVoice: any = {
            provider: voiceProvider,
            voiceId: voiceId,
            chunkPlan: {
              enabled: true,
              minCharacters: 30,
              punctuationBoundaries: [".", "!", "?", ",", ";"],
            },
            fillerInjectionEnabled: settings['vapi_filler_injection_enabled'] === 'true',
          };

          if (voiceProvider === '11labs') {
            // ElevenLabs full configuration (existing behavior preserved)
            baseVoice.model = settings['elevenlabs_model'] || 'eleven_turbo_v2_5';
            baseVoice.stability = voiceStability;
            baseVoice.similarityBoost = voiceSimilarityBoost;
            baseVoice.style = voiceStyle;
            baseVoice.speed = voiceSpeed;
            baseVoice.useSpeakerBoost = settings['vapi_voice_speaker_boost'] === 'true';
          } else {
            // Other providers (cartesia, openai, azure, ...): use model_id from voice_settings
            if (voiceSettings?.model_id) {
              baseVoice.model = voiceSettings.model_id;
            }
            // Optional provider-specific settings (JSONB) override/extend the payload
            // Example for Cartesia: { "language": "it", "speed": "normal", "emotion": ["positivity:high"] }
            if (voiceSettings?.provider_settings && typeof voiceSettings.provider_settings === 'object') {
              Object.assign(baseVoice, voiceSettings.provider_settings);
            }
          }

          return baseVoice;
        })(),

        // Transcriber configuration - use settings from admin panel
        // Different providers require different model formats
        transcriber: {
          provider: settings['vapi_transcriber_provider'],
          model: transcriberModel,
          language: transcriberLanguage,
        },
        
        // CRITICAL: Start speaking plan - from admin settings
        startSpeakingPlan: {
          waitSeconds: parseFloat(settings['vapi_start_speaking_wait'] || '0.4'),
          smartEndpointingEnabled: settings['vapi_smart_endpointing_enabled'] !== 'false', // default true
          transcriptionEndpointingPlan: {
            onPunctuationSeconds: 0.1,
            onNoPunctuationSeconds: 0.8,
            onNumberSeconds: 0.5,
          },
        },
        
        // CRITICAL: Stop speaking plan - from admin settings
        stopSpeakingPlan: {
          numWords: parseInt(settings['vapi_stop_speaking_num_words'] || '0'),
          voiceSeconds: parseFloat(settings['vapi_stop_speaking_voice_seconds'] || '0.2'),
          backoffSeconds: parseFloat(settings['vapi_stop_speaking_backoff_seconds'] || '1.0'),
        },
        
        // Call behavior settings
        silenceTimeoutSeconds: parseInt(settings['vapi_silence_timeout']),
        maxDurationSeconds: Math.min(
          parseInt(settings['vapi_max_duration']),
          prank.max_duration || 300
        ),
        endCallMessage: endCallMessage,
        endCallFunctionEnabled: true,
        recordingEnabled: recordingEnabled,
        
        // CRITICAL: Artifact plan for quality recordings
        artifactPlan: {
          recordingEnabled: recordingEnabled,
          videoRecordingEnabled: false,
          transcriptPlan: {
            enabled: true,
            assistantName: 'AI',
          },
        },
      },
    };

    // Background sound: explicitly send 'off' to avoid any provider defaults
    const bgSound = (settings['vapi_background_sound'] || 'off').trim();
    if (bgSound === 'off') {
      vapiCallBody.assistant.backgroundSound = 'off';
    } else if (bgSound === 'office' || bgSound.startsWith('http')) {
      vapiCallBody.assistant.backgroundSound = bgSound;
    }

    // Add backchanneling if enabled (natural "mhm", "ok" responses)
    if (settings['vapi_backchanneling'] === 'true') {
      vapiCallBody.assistant.backchannelingEnabled = true;
    }

    // Add background denoising if enabled
    if (settings['vapi_background_denoising'] === 'true') {
      vapiCallBody.assistant.backgroundDenoisingEnabled = true;
    }

    // Add voicemail detection if enabled - VAPI only accepts provider, no voicemailMessage
    if (settings['vapi_voicemail_detection'] === 'true') {
      vapiCallBody.assistant.voicemailDetection = {
        provider: 'vapi',
      };
    }

    // Add HIPAA mode if enabled
    if (settings['vapi_hipaa_enabled'] === 'true') {
      vapiCallBody.assistant.hipaaEnabled = true;
    }

    // Add end call phrases if configured
    if (settings['vapi_end_call_phrases']) {
      const phrases = settings['vapi_end_call_phrases'].split(',').map((p: string) => p.trim()).filter(Boolean);
      if (phrases.length > 0) {
        vapiCallBody.assistant.endCallPhrases = phrases;
      }
    }

    console.log('=== VAPI REQUEST ===');
    console.log('Request Body:', JSON.stringify(vapiCallBody, null, 2));

    // === CALL VAPI API ===
    const vapiResponse = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vapiCallBody),
    });

    const vapiData = await vapiResponse.json();

    if (!vapiResponse.ok) {
      console.error('VAPI API Error:', vapiData);
      
      // === ROLLBACK: Decrement current_calls since call failed to initiate ===
      console.log('Rolling back current_calls for caller ID:', selectedCallerId.id);
      const { error: rollbackError } = await supabase
        .from('verified_caller_ids')
        .update({ current_calls: Math.max(0, (selectedCallerId.current_calls || 0)) })
        .eq('id', selectedCallerId.id);
      if (rollbackError) {
        console.error('Error rolling back current_calls:', rollbackError);
      }
      
      throw new Error(vapiData.message || vapiData.error || JSON.stringify(vapiData));
    }

    console.log('=== VAPI CALL INITIATED ===');
    console.log('Call ID:', vapiData.id);
    console.log('Status:', vapiData.status);

    // Update prank with VAPI call ID
    const { error: updateError } = await supabase
      .from('pranks')
      .update({
        call_status: 'initiated',
        twilio_call_sid: vapiData.id, // Store VAPI call ID for tracking
      })
      .eq('id', prankId);

    if (updateError) {
      console.error('Failed to update prank status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        callId: vapiData.id,
        provider: 'vapi',
        firstMessage: firstMessage,
        message: 'VAPI call initiated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('=== VAPI CALL ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Mark prank as failed so it doesn't stay stuck as 'pending'
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { prankId: failedPrankId } = await req.clone().json().catch(() => ({ prankId: null }));
      if (failedPrankId) {
        await supabase
          .from('pranks')
          .update({ call_status: 'failed' })
          .eq('id', failedPrankId);
        console.log('Prank marked as failed:', failedPrankId);
      }
    } catch (updateErr) {
      console.error('Failed to mark prank as failed:', updateErr);
    }
    
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});