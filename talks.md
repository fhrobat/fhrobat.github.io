---
layout: page
title: Talks and visits
custom_js: theme
---

{% assign publications = site.data.menu.entries | where: "id", "publications" | first %}
{{ publication.content }}
