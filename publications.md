---
layout: page
title: Publications
custom_js:
  - theme
  - bibtex
---

{% assign publications = site.data.menu.entries | where: "id", "publications" | first %}
{{ publications.content }}
