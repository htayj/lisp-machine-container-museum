# Repository guidance

## Museum documentation

This repository is both runnable preservation infrastructure and a museum knowledge
base for Lisp-machine history. Durable historical or technical knowledge discovered
while working here is part of the deliverable, not chat-only context.

- Keep the canonical knowledge base in `docs/`.
- Treat `docs/` as an Open Knowledge Format (OKF) 0.1 bundle. Follow the local
  profile in `docs/writing-guide.md`; do not assume that similarly named personal
  OKF collections are the destination for this repository's museum content.
- Put Symbolics Genera and Open Genera material under `docs/genera/`.
- Put MIT CADR and LM-3 material under `docs/mit-cadr/`.
- Link every new article from its section index and from `docs/index.md` when it is a
  useful entry point.
- Update the relevant article when implementation or debugging work reveals reusable
  facts about architecture, file formats, boot behavior, software lineage, operation,
  or preservation. Do not document routine noise that has no lasting value.
- Keep the root `README.md` focused on operating this repository. Put historical and
  explanatory material in the knowledge base and link to it as appropriate.

Write portable GitHub-Flavored Markdown, using only CommonMark and broadly supported
GFM extensions such as pipe tables, so the same files can later feed a static-site
generator. Every non-reserved concept document must begin with parseable YAML
frontmatter containing at least `type`, `title`, `description`, and `timestamp`.
Update `timestamp` after a meaningful content change. `index.md` and `log.md` are
OKF-reserved files and follow the rules in the writing guide. Use relative links
inside the repository, one H1 per page, descriptive lowercase-hyphenated filenames,
and no generator-specific shortcodes unless the site toolchain explicitly adopts
them.

## Evidence and preservation standards

- Lead with the direct conclusion, then explain the evidence.
- Distinguish sourced fact, local observation, interpretation, and open question.
- Prefer primary sources: original manuals, contemporary papers, source code, release
  media inventories, and direct inspection of preserved artifacts.
- Cite public sources with stable direct links. Pin source-code links to a commit when
  the exact implementation matters, and record the verification date for changing
  tools or repositories.
- For local artifact observations, record enough non-secret provenance to reproduce
  the result, such as filename, byte size, checksum, and command or tool version. Do
  not publish machine-specific absolute paths.
- Do not upload, reproduce, or quote extensively from licensed Genera media. The
  purchased Open Genera archive, world images, and extracted proprietary files remain
  untracked local inputs. Describe format and behavior in original words and use short
  quotations only when necessary.
- Keep every Genera font extraction product, including BDF, normalized JSON, and PNG
  specimen sheets, under the ignored `build/fonts/genera/` tree. The extractor and
  evidence-only catalog may be tracked, but no recovered glyph data may be committed.
- CADR font assets recovered from the public source tree may be tracked when their
  exact source revision and license accompany them. Recover them from `src/lmfont`
  source representations, not from a load band merely because one is available.
- Keep the distinction between the public MIT CADR/LM-3 materials and licensed
  Symbolics/Open Genera materials explicit.
- Preserve uncertainty. If an acronym expansion, lineage claim, or format detail is
  not established by evidence, label it unknown or inferred instead of guessing.

Before finishing work that produced museum-relevant knowledge, check whether the
corresponding `docs/` page and indexes need an update.
