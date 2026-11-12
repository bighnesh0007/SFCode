# Certification Prep question bank

One JSON file per exam, validated at server start
(`src/services/certification/bank.ts`): a malformed file stops the server.

- Questions are **original** and written from the public exam outlines — never copied
  from exam dumps or other question banks.
- `answer` lists the correct option ids; more than one means a "Choose N" question
  (say so in the prompt).
- `explanation` is shown after answering. Explain *why*, including why the
  tempting wrong options are wrong.
- Question ids are permanent: attempts are stored against them. Fix a question in
  place; never reuse an id for a different question.
