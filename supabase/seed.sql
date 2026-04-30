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

-- BUNDLES — BASIC TIER (43)
-- Each bundle gates 9 courses. Courses are mapped via courses.bundle_id.
-- Translations are jsonb keyed by language code (en, hi, hinglish, mr, pa, te, ta, fr, es, bn).
insert into bundles (slug, plan_tier, emoji, cover_gradient, order_index, translations) values
  ('b-what-is-ai',                'basic', '🌱', 'moss',  100, '{"en":{"title":"What is AI & How Will It Help Me?","description":"The context behind the hype."}}'::jsonb),
  ('b-easier-life-with-chatgpt',  'basic', '💬', 'ember', 101, '{"en":{"title":"Make Your Life Easier with ChatGPT","description":"Daily wins with the world''s most popular AI."}}'::jsonb),
  ('b-chatgpt-pro',               'basic', '⚡', 'ember', 102, '{"en":{"title":"How to Use ChatGPT''s Pro Version","description":"Squeeze every drop out of Plus."}}'::jsonb),
  ('b-design-with-canva-ai',      'basic', '✨', 'moss',  103, '{"en":{"title":"Design Anything in Minutes with Canva AI","description":"Magic Studio, mastered."}}'::jsonb),
  ('b-gemini-all-in-one',         'basic', '💎', 'ember', 104, '{"en":{"title":"Your All-in-One AI Assistant with Gemini","description":"Google''s quiet powerhouse."}}'::jsonb),
  ('b-deepl-translate',           'basic', '🌐', 'paper', 105, '{"en":{"title":"Speak Any Language with DeepL — Translate Like a Pro","description":"Translation that sounds native."}}'::jsonb),
  ('b-character-ai',              'basic', '🎭', 'moss',  106, '{"en":{"title":"Chat with AI Characters — Learn, Play & Create","description":"Roleplay, practice, create."}}'::jsonb),
  ('b-perplexity-research',       'basic', '🔎', 'ember', 107, '{"en":{"title":"Research Smarter with Perplexity — Your AI Scholar","description":"Sourced answers, faster."}}'::jsonb),
  ('b-removebg',                  'basic', '🪄', 'paper', 108, '{"en":{"title":"One-Click Photo Magic — Backgrounds Gone","description":"Remove.bg, unlocked."}}'::jsonb),
  ('b-quillbot',                  'basic', '📝', 'moss',  109, '{"en":{"title":"Rewrite Smarter, Write Faster with QuillBot","description":"Paraphrase without flattening."}}'::jsonb),
  ('b-ai-grammar-coach',          'basic', '🎓', 'paper', 110, '{"en":{"title":"Perfect Your Writing — AI Grammar Coach","description":"Polish every line."}}'::jsonb),
  ('b-claude-conversations',      'basic', '🧬', 'moss',  111, '{"en":{"title":"Think Big with Claude — Smarter AI Conversations","description":"Long context, thoughtful answers."}}'::jsonb),
  ('b-suno-music',                'basic', '🎵', 'ember', 112, '{"en":{"title":"Make Music with AI — Your Suno Studio","description":"Text to track in minutes."}}'::jsonb),
  ('b-ai-app-hub',                'basic', '🧩', 'paper', 113, '{"en":{"title":"All-in-One AI App Hub — Discover, Compare, Use","description":"One place for every model."}}'::jsonb),
  ('b-capcut-ai',                 'basic', '🎞️', 'moss',  114, '{"en":{"title":"Edit Videos Like a Pro with CapCut AI","description":"Cut, caption, polish."}}'::jsonb),
  ('b-office-copilot',            'basic', '💼', 'paper', 115, '{"en":{"title":"Your Everyday Office Copilot — Work Smarter","description":"Microsoft Copilot for daily work."}}'::jsonb),
  ('b-quizizz',                   'basic', '🧠', 'ember', 116, '{"en":{"title":"AI-Powered Learning Games with Quizizz","description":"Make learning stick."}}'::jsonb),
  ('b-elevenlabs',                'basic', '🎙️', 'moss',  117, '{"en":{"title":"Give AI a Voice — Create Speech with ElevenLabs","description":"Realistic voices, on demand."}}'::jsonb),
  ('b-deepai',                    'basic', '🌊', 'paper', 118, '{"en":{"title":"Explore the World of AI Tools with DeepAI","description":"A buffet of models."}}'::jsonb),
  ('b-midjourney-art',            'basic', '🖼️', 'ember', 119, '{"en":{"title":"Create Stunning Art with Midjourney","description":"Prompt to poster."}}'::jsonb),
  ('b-runway-video',              'basic', '🎬', 'moss',  120, '{"en":{"title":"AI Video Magic — Editing with Runway","description":"Generative video, day one."}}'::jsonb),
  ('b-copy-ai',                   'basic', '✍️', 'paper', 121, '{"en":{"title":"Write Anything in Seconds with Copy.ai","description":"From blank page to polished copy."}}'::jsonb),
  ('b-otter-ai',                  'basic', '🦦', 'ember', 122, '{"en":{"title":"Never Miss a Meeting — Transcribe with Otter AI","description":"Notes that take themselves."}}'::jsonb),
  ('b-jasper',                    'basic', '👻', 'moss',  123, '{"en":{"title":"AI Copywriter for Businesses — Jasper Mastery","description":"On-brand at scale."}}'::jsonb),
  ('b-adobe-firefly',             'basic', '🔥', 'ember', 124, '{"en":{"title":"Creative Superpowers with Adobe Firefly","description":"Generative inside Adobe."}}'::jsonb),
  ('b-github-copilot',            'basic', '👨‍💻', 'paper', 125, '{"en":{"title":"Code Smarter, Faster with GitHub Copilot","description":"Pair-programmer in your IDE."}}'::jsonb),
  ('b-notion-ai',                 'basic', '🗒️', 'moss',  126, '{"en":{"title":"Organize Life & Work with Notion AI","description":"Notes, docs, plans — assisted."}}'::jsonb),
  ('b-synthesia',                 'basic', '🎥', 'ember', 127, '{"en":{"title":"Make AI Videos with Synthesia — No Camera Needed","description":"Avatar videos in minutes."}}'::jsonb),
  ('b-zapier',                    'basic', '🔗', 'paper', 128, '{"en":{"title":"Automate Your Life with Zapier AI","description":"Workflows that run themselves."}}'::jsonb),
  ('b-fireflies',                 'basic', '🪰', 'moss',  129, '{"en":{"title":"AI Meeting Notes with Fireflies","description":"Capture, search, share."}}'::jsonb),
  ('b-gamma',                     'basic', '📊', 'ember', 130, '{"en":{"title":"AI Presentations in Minutes with Gamma","description":"From prompt to deck."}}'::jsonb),
  ('b-sudowrite',                 'basic', '📚', 'paper', 131, '{"en":{"title":"Write Better Stories with Sudowrite AI","description":"A novelist''s second pair of hands."}}'::jsonb),
  ('b-consensus',                 'basic', '📑', 'moss',  132, '{"en":{"title":"Research Papers Simplified with Consensus","description":"Evidence-backed answers."}}'::jsonb),
  ('b-descript',                  'basic', '🎚️', 'ember', 133, '{"en":{"title":"Edit Audio & Video by Editing Text — Descript AI","description":"Type to cut."}}'::jsonb),
  ('b-veo-3',                     'basic', '🎬', 'paper', 134, '{"en":{"title":"Next-Gen Video Creation with Veo 3","description":"State-of-the-art video gen."}}'::jsonb),
  ('b-fathom',                    'basic', '🐟', 'moss',  135, '{"en":{"title":"AI Meeting Highlights & Summaries with Fathom","description":"Skip to the point."}}'::jsonb),
  ('b-murf',                      'basic', '🎤', 'ember', 136, '{"en":{"title":"Studio-Quality Voiceovers with Murf AI","description":"Pro voiceovers, no booth."}}'::jsonb),
  ('b-grok',                      'basic', '🤖', 'paper', 137, '{"en":{"title":"Smart Conversations Anywhere with Grok AI","description":"Real-time AI on X."}}'::jsonb),
  ('b-deepseek',                  'basic', '🔬', 'moss',  138, '{"en":{"title":"Push AI Limits — Explore with DeepSeek","description":"Open frontier model."}}'::jsonb),
  ('b-cursor-code',               'basic', '⌨️', 'ember', 139, '{"en":{"title":"Code Like a Pro with Cursor AI","description":"AI-first code editor."}}'::jsonb),
  ('b-simplified-ai',             'basic', '🪶', 'paper', 140, '{"en":{"title":"Design, Write & Market with Simplified AI","description":"One studio for content teams."}}'::jsonb),
  ('b-wordtune',                  'basic', '🗣️', 'moss',  141, '{"en":{"title":"Say It Better — AI Writing with Wordtune","description":"Rephrase like a native."}}'::jsonb),
  ('b-writesonic',                'basic', '🎙️', 'ember', 142, '{"en":{"title":"Content Creation at Scale with Writesonic","description":"Volume content, on brand."}}'::jsonb);

-- BUNDLES — ADVANCED TIER (22)
insert into bundles (slug, plan_tier, emoji, cover_gradient, order_index, translations) values
  ('b-prompt-engineering-mastery',  'advanced', '🎯', 'ember', 200, '{"en":{"title":"Prompt Engineering Mastery — Become an AI Power User in 14 Days","description":"Structured prompting, few-shot, eval."}}'::jsonb),
  ('b-gemini-grandmastery',         'advanced', '💎', 'moss',  201, '{"en":{"title":"Gemini Grandmastery — Multimodal AI Skills for Work & Life","description":"Text, vision, code, audio with Gemini."}}'::jsonb),
  ('b-claude-deepthink',            'advanced', '🧬', 'paper', 202, '{"en":{"title":"Claude DeepThink — Advanced AI Research & Writing Lab","description":"Projects, Artifacts, extended thinking."}}'::jsonb),
  ('b-workplace-copilot',           'advanced', '💼', 'ember', 203, '{"en":{"title":"Workplace AI Mastery — Excel, Word & Outlook with Copilot","description":"Real office work — not demos."}}'::jsonb),
  ('b-coding-architect-copilot',    'advanced', '🏗️', 'moss',  204, '{"en":{"title":"AI Coding Architect — Build Software Faster with Copilot","description":"Architect, ship, review with AI."}}'::jsonb),
  ('b-midjourney-art-studio',       'advanced', '🎨', 'paper', 205, '{"en":{"title":"AI Art Studio — Midjourney Visual Mastery Program","description":"Style libraries, consistent characters."}}'::jsonb),
  ('b-runway-cinematic',            'advanced', '🎬', 'ember', 206, '{"en":{"title":"Cinematic AI — 14 Days to Video Editing with Runway","description":"Gen-3 workflows, motion brush."}}'::jsonb),
  ('b-notion-productivity',         'advanced', '🗂️', 'moss',  207, '{"en":{"title":"Productivity Architect — 14 Days to Organizing with Notion AI","description":"Build a second brain that runs itself."}}'::jsonb),
  ('b-zapier-automation-empire',    'advanced', '⚙️', 'paper', 208, '{"en":{"title":"Automation Empire — Build AI Workflows with Zapier","description":"Stop doing it by hand."}}'::jsonb),
  ('b-creators-ai-studio',          'advanced', '🎚️', 'ember', 209, '{"en":{"title":"Creator''s AI Studio — Edit Audio & Video Like Text","description":"Descript end-to-end."}}'::jsonb),
  ('b-ai-music-lab',                'advanced', '🎼', 'moss',  210, '{"en":{"title":"AI Music Lab — Compose & Produce Tracks in 14 Days","description":"Songwriting with AI co-producers."}}'::jsonb),
  ('b-virtual-studio-pro',          'advanced', '🎥', 'paper', 211, '{"en":{"title":"Virtual Studio Pro — AI Video Presentations Mastery","description":"Synthesia + scripts + voice."}}'::jsonb),
  ('b-firefly-mastery',             'advanced', '🔥', 'ember', 212, '{"en":{"title":"Creative Intelligence — Master AI Design with Firefly","description":"Generative inside Photoshop and Illustrator."}}'::jsonb),
  ('b-cursor-developer-mastery',    'advanced', '⌨️', 'moss',  213, '{"en":{"title":"AI Developer Mastery — Supercharge Coding with Cursor","description":"Composer, rules files, full features."}}'::jsonb),
  ('b-photo-cleanup-mastery',       'advanced', '🪄', 'paper', 214, '{"en":{"title":"AI Photo Cleanup — Background Removal Mastery","description":"Bulk, batch, brand-perfect."}}'::jsonb),
  ('b-rewrite-genius',              'advanced', '✏️', 'ember', 215, '{"en":{"title":"Rewrite Genius — Paraphrasing & Polishing with AI","description":"Tone, voice, register — at will."}}'::jsonb),
  ('b-pro-writing-lab',             'advanced', '📐', 'moss',  216, '{"en":{"title":"Pro Writing Lab — Error-Free Communication with AI","description":"Grammar, clarity, style — locked in."}}'::jsonb),
  ('b-meeting-memory-pro',          'advanced', '🧠', 'paper', 217, '{"en":{"title":"Meeting Memory Pro — Capture Every Word with AI","description":"Otter + Fireflies + Fathom, mastered."}}'::jsonb),
  ('b-marketing-copy-accelerator',  'advanced', '📣', 'ember', 218, '{"en":{"title":"Marketing Copy Accelerator — 10x Content with AI","description":"Funnels, landing pages, ads."}}'::jsonb),
  ('b-jasper-brand-writer',         'advanced', '👻', 'moss',  219, '{"en":{"title":"AI Brand Writer — Advanced Business Copy with Jasper","description":"Brand voice at scale."}}'::jsonb),
  ('b-pitch-deck-studio',           'advanced', '📊', 'paper', 220, '{"en":{"title":"AI Pitch Deck Studio — Create Killer Presentations Fast","description":"Story, design, delivery."}}'::jsonb),
  ('b-consensus-research',          'advanced', '📑', 'ember', 221, '{"en":{"title":"AI Research Assistant — Mastering Consensus","description":"Literature reviews, faster."}}'::jsonb);

-- COURSES — FREE TIER (8)
insert into courses (slug, title, subtitle, description, category, plan_tier, emoji, cover_gradient, difficulty, estimated_minutes, order_index, tags) values
  ('chatgpt-basics',          'ChatGPT Basics',                        'Your first real conversation',  'The single most useful habit of the decade, in about an hour.', 'foundations', 'free', '💬', 'ember',  'beginner', 45, 1, '{ai,chatgpt,starter}'),
  ('canva-magic',             'Canva Magic',                           'Design without a designer',     'Use Canva''s AI to make posts, decks, and thumbnails.',           'creative',    'free', '🎨', 'moss',   'beginner', 40, 2, '{design,canva,creative}'),
  ('ai-basics',               'AI Basics',                             'The only primer you need',      'What "AI" actually means, in plain language.',                   'foundations', 'free', '🧭', 'paper',  'beginner', 35, 3, '{ai,fundamentals}'),
  ('how-does-machine-learn',  'How Does a Machine Learn?',             'The idea behind the idea',      'Training, data, patterns — explained with analogies.',           'foundations', 'free', '🧠', 'ember',  'beginner', 25, 4, '{ml,theory}'),
  ('nlp-basics',              'What is Natural Language Processing?',  'Why ChatGPT understands you',   'How machines read and write language. Zero jargon.',             'foundations', 'free', '📝', 'moss',   'beginner', 25, 5, '{nlp,theory}'),
  ('how-does-ai-work',        'How Does AI Work?',                     'Peek under the hood',           'A 25-minute walkthrough of prompt to answer.',                   'foundations', 'free', '⚙️', 'paper',  'beginner', 25, 6, '{ai,theory}'),
  ('photo-editing-ai',        'Photo Editing with AI',                 'One-click retouching',          'Remove backgrounds, fix lighting, enhance — three tools.',       'creative',    'free', '📸', 'ember',  'beginner', 30, 7, '{photo,creative}'),
  ('insta-post-with-ai',      'Create an Insta Post with AI',          'Idea to caption in 10 minutes', 'A full post from scratch using only AI.',                        'creative',    'free', '📱', 'moss',   'beginner', 30, 8, '{social,instagram,creative}'),
  ('chatgpt-basics-hinglish', 'ChatGPT Basics — Hinglish',             'Wahi course, par Hinglish mein','ChatGPT ka asli istemaal — Hindi-English mix mein, Indian dosti waali tone mein.', 'foundations', 'free', '💬', 'ember',  'beginner', 90, 50, '{ai,chatgpt,hinglish,india}');

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

-- LANGUAGE LINKAGE: link Hinglish course to its English sibling.
-- Future language variants append to the same group with their own language_code.
do $$
declare v_group uuid := uuid_generate_v4();
begin
  update courses set course_group_id = v_group, language_code = 'en'
    where slug = 'chatgpt-basics';
  update courses set course_group_id = v_group, language_code = 'hinglish'
    where slug = 'chatgpt-basics-hinglish';
end $$;

-- Lessons and turns are authored as YAML under supabase/content/ and loaded
-- via `npm run content:load`. See supabase/content/AUTHORING.md.
