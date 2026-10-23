---
layout: page
title: Publications
description: Papers and preprints by Francesco Hrobat on numerical linear algebra, with arXiv links, code and BibTeX.
custom_js:
  - theme
  - bibtex
  - anims
---

{% assign publications = site.data.menu.entries | where: "id", "publications" | first %}
{{ publications.content }}
