---
layout: page
title: Education
description: Education of Francesco Hrobat, from the University of Pisa and the Scuola Normale Superiore to a PhD at the University of Oxford.
custom_js: theme
---

{% assign education = site.data.menu.entries | where: "id", "education" | first %}
{{ education.content }}
