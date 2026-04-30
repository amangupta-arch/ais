-- Tags on bundles. Free-form for now ('utility' is the first tag); future tags
-- come from product (e.g. 'india', 'income', 'career', 'exam_prep').
alter table bundles add column tags text[] not null default '{}';
create index idx_bundles_tags on bundles using gin(tags);
