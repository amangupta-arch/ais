-- PLANS
insert into plans (id, name, tagline, description, price_inr, price_usd, billing_period_days, streak_unlock_days, sort_order, features) values
  ('free',     'Free',     'Taste the method',     'A handful of lessons to see how AIS feels. No card, no pressure.',   0,   0,    30, 1,  0,
    '["1-day streak goal","8 starter courses","Daily 1 lesson","Basic streak + XP"]'::jsonb),
  ('basic',    'Basic',    'Build the habit',      'The full tool-literacy ladder — ChatGPT, Canva, Gemini, and 40 more.', 199, 2.99, 30, 9,  1,
    '["9-day streak goal","43 tool mastery courses","Unlimited daily lessons","Streak freezes x2","League access"]'::jsonb),
  ('advanced', 'Advanced', 'Become the operator',  'Deep courses on the stacks professionals actually use.',              499, 6.99, 60, 14, 2,
    '["14-day streak goal","22 mastery programmes","All Basic perks","Priority new courses","All bonus bundles unlocked","Certificate of completion"]'::jsonb);

-- ACHIEVEMENTS
insert into achievements (id, title, description, icon, category, xp_reward) values
  ('streak_3',     'First Spark',    'Three days in a row. The hardest part.',                 'flame',  'streak',   60),
  ('streak_9',     'Habit Forming',  'Nine-day streak. You unlocked the Basic rhythm.',        'flame',  'streak',  150),
  ('streak_14',    'Forged',         'Two solid weeks. This is who you are now.',              'flame',  'streak',  300),
  ('streak_30',    'Devoted',        'A full month. You''ve rewired something real.',           'flame',  'streak',  600),
  ('first_lesson', 'Opening Move',   'Your first lesson, in the books.',                       'bolt',   'progress', 20),
  ('first_course', 'Completist',     'First full course behind you. Onto the next.',           'trophy', 'progress',100),
  ('five_courses', 'Polymath',       'Five courses deep. You''re covering real ground.',        'trophy', 'progress',300),
  ('night_owl',    'Night Owl',      'A lesson finished after 11pm. Rare breed.',              'moon',   'special',  40);

-- COURSES — FREE TIER (8)
insert into courses (slug, title, subtitle, description, category, plan_tier, emoji, cover_gradient, difficulty, estimated_minutes, order_index, tags) values
  ('chatgpt-basics',          'ChatGPT Basics',                        'Your first real conversation',  'The single most useful habit of the decade, in about an hour.', 'foundations', 'free', '💬', 'ember',  'beginner', 45, 1, '{ai,chatgpt,starter}'),
  ('canva-magic',             'Canva Magic',                           'Design without a designer',     'Use Canva''s AI to make posts, decks, and thumbnails.',           'creative',    'free', '🎨', 'moss',   'beginner', 40, 2, '{design,canva,creative}'),
  ('ai-basics',               'AI Basics',                             'The only primer you need',      'What "AI" actually means, in plain language.',                   'foundations', 'free', '🧭', 'paper',  'beginner', 35, 3, '{ai,fundamentals}'),
  ('how-does-machine-learn',  'How Does a Machine Learn?',             'The idea behind the idea',      'Training, data, patterns — explained with analogies.',           'foundations', 'free', '🧠', 'ember',  'beginner', 25, 4, '{ml,theory}'),
  ('nlp-basics',              'What is Natural Language Processing?',  'Why ChatGPT understands you',   'How machines read and write language. Zero jargon.',             'foundations', 'free', '📝', 'moss',   'beginner', 25, 5, '{nlp,theory}'),
  ('how-does-ai-work',        'How Does AI Work?',                     'Peek under the hood',           'A 25-minute walkthrough of prompt to answer.',                   'foundations', 'free', '⚙️', 'paper',  'beginner', 25, 6, '{ai,theory}'),
  ('photo-editing-ai',        'Photo Editing with AI',                 'One-click retouching',          'Remove backgrounds, fix lighting, enhance — three tools.',       'creative',    'free', '📸', 'ember',  'beginner', 30, 7, '{photo,creative}'),
  ('insta-post-with-ai',      'Create an Insta Post with AI',          'Idea to caption in 10 minutes', 'A full post from scratch using only AI.',                        'creative',    'free', '📱', 'moss',   'beginner', 30, 8, '{social,instagram,creative}');

-- COURSES — BASIC TIER (10 of 43, seed more as content is authored)
insert into courses (slug, title, subtitle, description, category, plan_tier, emoji, cover_gradient, difficulty, estimated_minutes, order_index, tags) values
  ('what-is-ai',              'What is AI & How Will It Help Me?',   'The context behind the hype',     'Level-setting deep dive.',                                        'foundations', 'basic', '🌱', 'moss',  'beginner',     35, 10, '{ai,foundations}'),
  ('chatgpt-pro',             'How to Use ChatGPT Pro',              'Squeeze every drop',              'Projects, GPTs, memory, voice — why Pro is worth it.',            'tools',       'basic', '⚡', 'ember', 'intermediate', 50, 11, '{chatgpt,advanced}'),
  ('design-with-canva-ai',    'Design Anything in Minutes — Canva AI','Magic Studio, mastered',         'Magic Design, Magic Write, Magic Edit. Complete loop.',           'creative',    'basic', '✨', 'moss',  'beginner',     45, 12, '{canva,design}'),
  ('all-in-one-gemini',       'Your All-in-One Assistant — Gemini',  'Google''s quiet powerhouse',     'Gemini across Docs, Gmail, Sheets, Drive.',                        'tools',       'basic', '💎', 'ember', 'intermediate', 50, 13, '{gemini,google}'),
  ('translate-with-deepl',    'Speak Any Language — DeepL',          'Translate like a native',         'DeepL vs Google Translate, multilingual workflow.',                'tools',       'basic', '🌐', 'paper', 'beginner',     35, 14, '{translate,deepl}'),
  ('character-ai',            'Chat with AI Characters',             'Practice conversations safely',   'Roleplay, interviews, language practice.',                         'creative',    'basic', '🎭', 'moss',  'beginner',     40, 15, '{character-ai,roleplay}'),
  ('perplexity-scholar',      'Research Smarter — Perplexity',       'Your AI scholar',                 'Real sources, follow-up threading, focused search modes.',         'tools',       'basic', '🔎', 'ember', 'intermediate', 40, 16, '{research,perplexity}'),
  ('remove-bg-one-click',     'One-Click Photo Magic — Remove.bg',   'Backgrounds, gone',               'Product shots, portraits, bulk replacements.',                     'creative',    'basic', '🪄', 'paper', 'beginner',     20, 17, '{photo,removebg}'),
  ('quillbot-rewrite',        'Rewrite Smarter — QuillBot',          'Paraphrase without flattening',   'Tone shifts, summarising, grammar.',                               'creative',    'basic', '📝', 'moss',  'beginner',     30, 18, '{writing,quillbot}'),
  ('midjourney-art',          'Create Stunning Art — Midjourney',    'From prompt to poster',           'Midjourney v6 prompting, parameters, style consistency.',         'creative',    'basic', '🖼️', 'ember', 'intermediate', 55, 19, '{midjourney,art}');

-- COURSES — ADVANCED TIER (6 of 22)
insert into courses (slug, title, subtitle, description, category, plan_tier, emoji, cover_gradient, difficulty, estimated_minutes, order_index, tags) values
  ('prompt-engineering-14d',  'Prompt Engineering Mastery',          '14 days to AI power user',        'Structured prompting, few-shot, chain-of-thought, eval.',         'foundations', 'advanced', '🎯', 'ember', 'advanced', 240, 20, '{prompting,mastery}'),
  ('claude-deepthink',        'Claude DeepThink',                    'Advanced research & writing',     'Projects, Artifacts, extended thinking.',                          'tools',       'advanced', '🧬', 'moss',  'advanced', 180, 21, '{claude,research}'),
  ('copilot-at-work',         'Workplace AI Mastery — Copilot',      'Excel, Word, Outlook, Teams',     'Microsoft Copilot for real office work — not demos.',              'productivity','advanced', '💼', 'paper', 'advanced', 200, 22, '{copilot,microsoft}'),
  ('runway-video',            'Cinematic AI — Runway',               'Video that doesn''t look AI',      'Gen-3 workflows, motion brush, a 60-second cut.',                  'creative',    'advanced', '🎬', 'ember', 'advanced', 180, 23, '{runway,video}'),
  ('zapier-automation',       'Automation Empire — Zapier AI',       'Stop doing it by hand',           'Build 10 automations across Gmail, Sheets, Slack, Notion.',        'productivity','advanced', '🔗', 'moss',  'advanced', 220, 24, '{zapier,automation}'),
  ('cursor-for-builders',     'AI Developer Mastery — Cursor',       'Ship 10× faster',                 'Cursor composer, rules files, building a full feature.',           'tools',       'advanced', '⌨️', 'paper', 'advanced', 240, 25, '{cursor,coding}');

-- BONUS BUNDLES (8 of 35 — the India moat)
insert into courses (slug, title, subtitle, description, category, plan_tier, is_bonus_badge, emoji, cover_gradient, difficulty, estimated_minutes, order_index, tags) values
  ('kheti-mein-ai',           'Kheti Mein AI Ka Sahara',       'Farming, smarter',                  'Weather, pest ID, mandi prices, schemes — via AI, in Hindi.',    'real_life', 'basic',    true, '🌾', 'moss',  'beginner',     50, 30, '{agriculture,india,hindi}'),
  ('ielts-success',           'AI-Powered IELTS Success Kit',  'Band 7+ with your phone',           'Writing task evaluation, speaking practice, 30-day plan.',       'exam_prep', 'advanced', true, '🎓', 'ember', 'intermediate', 180, 31, '{ielts,exam}'),
  ('neet-ug-prep',            'AI-Powered NEET-UG Prep',       'Doubt-solving at midnight',         'AI as 24/7 tutor for Bio, Physics, Chemistry.',                  'exam_prep', 'advanced', true, '🩺', 'ember', 'intermediate', 220, 32, '{neet,medical}'),
  ('kirana-ai',               'Kirana Shop Par AI Ka Istemaal','Chhoti dukaan, badi soch',          'Billing, WhatsApp marketing, AI-written posters.',                'real_life', 'basic',    true, '🛒', 'moss',  'beginner',     45, 33, '{business,india,hindi}'),
  ('ai-for-weddings',         'Plan My Wedding with AI',       'From invites to itinerary',         'Invite design, vendor shortlisting, budget, schedule.',          'real_life', 'basic',    true, '💍', 'ember', 'beginner',     60, 34, '{wedding,india}'),
  ('diet-planner',            'Plan My Diet',                  'A real plan, not a generic one',    'Turn goals, prefs, groceries into a weekly meal plan.',           'real_life', 'basic',    true, '🥗', 'moss',  'beginner',     30, 35, '{health,diet}'),
  ('resume-ai',               'Keep Your Resume Updated with AI','Always ready for the call',       'Living resume + JD-matched rewrites.',                             'real_life', 'advanced', true, '📄', 'paper', 'intermediate', 40, 36, '{career,resume}'),
  ('english-seekhna-ai-se',   'AI Se English Seekhna',         'Hindi se English tak',              'Conversation practice in Hinglish with AI.',                       'real_life', 'advanced', true, '🗣️', 'ember', 'beginner',     90, 37, '{english,india,hindi}');

-- DEMO LESSON — the canonical AI chat walkthrough example
do $$
declare v_course_id uuid;
declare v_lesson_id uuid;
begin
  select id into v_course_id from courses where slug = 'chatgpt-basics';

  insert into lessons (course_id, slug, title, subtitle, order_index, estimated_minutes, xp_reward)
  values (v_course_id, 'first-real-conversation', 'Your First Real Conversation', 'Why most people use ChatGPT wrong', 1, 8, 30)
  returning id into v_lesson_id;

  insert into lesson_turns (lesson_id, order_index, turn_type, content, xp_reward) values
    (v_lesson_id, 1, 'tutor_message',
      jsonb_build_object('text','Hey — glad you''re here. Before we touch ChatGPT, I want to ask you something.','persona_id','nova','typing_ms',900), 0),
    (v_lesson_id, 2, 'tutor_message',
      jsonb_build_object('text','Most people type one-line questions and get mediocre answers. Then they blame the tool. Sound familiar?','persona_id','nova','typing_ms',1400), 0),
    (v_lesson_id, 3, 'mcq',
      jsonb_build_object('question','Be honest — when you''ve used ChatGPT, you mostly…',
        'options', jsonb_build_array(
          jsonb_build_object('id','a','text','Typed a short question','is_correct',true,'rationale','Most people start here. We''ll fix it together.'),
          jsonb_build_object('id','b','text','Wrote a detailed prompt with context','is_correct',true,'rationale','You''re ahead of the curve. Let''s sharpen it anyway.'),
          jsonb_build_object('id','c','text','Never really used it','is_correct',true,'rationale','Perfect — you get to skip bad habits entirely.')
        )), 10),
    (v_lesson_id, 4, 'tutor_message',
      jsonb_build_object('text','Good. Here''s the one idea that changes everything: ChatGPT is not a search engine. It''s a thinking partner. And thinking partners need context.','persona_id','nova','typing_ms',1600), 0),
    (v_lesson_id, 5, 'tutor_message',
      jsonb_build_object('text','Watch. Same request, two versions.','persona_id','nova','typing_ms',700), 0),
    (v_lesson_id, 6, 'mcq',
      jsonb_build_object('question','Which prompt gets a better answer?',
        'options', jsonb_build_array(
          jsonb_build_object('id','a','text','"Write me an email to my boss"','is_correct',false,'rationale','Too thin. The AI has no idea what you want.'),
          jsonb_build_object('id','b','text','"Draft a 4-line email to my boss asking for 2 days off next week. Tone: polite but confident. Mention I''ll hand over the Figma files to Priya."','is_correct',true,'rationale','Context, constraint, tone, detail. Night and day output.')
        )), 15),
    (v_lesson_id, 7, 'tutor_message',
      jsonb_build_object('text','There''s your first rule: every prompt needs Role, Task, Context, and Constraints. Four words. RTCC.','persona_id','nova','typing_ms',1400), 0),
    (v_lesson_id, 8, 'exercise',
      jsonb_build_object('instruction','Your turn. Open ChatGPT in another tab. Using RTCC, ask it to write a LinkedIn post announcing you''re learning AI. Paste what you wrote below.','tool','chatgpt','placeholder','Paste your prompt here…'), 20),
    (v_lesson_id, 9, 'ai_conversation',
      jsonb_build_object(
        'starter_text','I''m your sparring partner for one minute. Tell me why you''re learning AI, and I''ll push back once. Ready?',
        'system_prompt','You are a warm but direct coach named Nova. The user is a beginner learner. Ask them why they are learning AI, then challenge their answer once to make it more specific. Keep replies under 40 words. After 2 exchanges, affirm them and close.',
        'goal','Help the user articulate a specific personal reason for learning AI.',
        'max_turns',3,
        'success_criteria','User names a concrete outcome (e.g., a project, role, or skill).'), 10),
    (v_lesson_id,10, 'reflection',
      jsonb_build_object('prompt','One sentence. What will you use ChatGPT for this week?','placeholder','Write in your own words…'), 5),
    (v_lesson_id,11, 'checkpoint',
      jsonb_build_object('title','You just learned RTCC.','summary','Role. Task. Context. Constraints. Every future prompt gets 5× better when you use it. Tomorrow — we build your first custom GPT.','xp',10), 10);
end $$;
