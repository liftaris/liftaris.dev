---
title: Building a Website
author: 'Kaio'
date: '2023-03-09T16:04:44.000Z'
---

I have been creating websites for a long time. In third grade I touched HTML for the first time; there was a week-long after-school program that culminated in writing a page that was supposedly sent to the White House (I'm not really sure why). It's lost to the void of time, but I wish I had some way of seeing it now.

Over the years, developing a website cam to be a marker of my progress. In high-school I knew a photographer that needed a portfolio website. In college, I had some assignments and projects that were on the web. When I needed to get a job? Better update that website.

Throughout it all, there's been a constant tug-and-pull that other developers will be familiar with, and it happens between the two poles of the full DIY method, and the drag-and-drop site builder solution.

Realistically, I want something in-between. I have been trying to find a solution that is highly customizable, but not garbage. And let me tell you, I've got a few piece of garbage sites under my belt. The real answer is, and has always been simplicity!&#x20;

Make it **simple**, make it **maintainable**, and make it **frictionless** to add content. The way I have this site set up right now with React, Next.js, and TinaCMS feels right because I feel like I'm addressing all of those points appropriately.

### Simple

It is immediately clear from the look of this site that that's what I was aiming for. It's got that minimalist, black-and-white aesthetic that is oh-so-easy to design around. That doesn't mean that I need to be boring! In fact, a lot of the CSS work is pretty straightforward because it's so simple, and I can use that time to make more interesting things like the homepage blob, or the wavy footer. They are small, simple things that serve the purpose of keeping the site looking just the way I like it, and makes it easier for me to express myself.

### Maintainable

Out of the three, this is the one I'm hitting the mark on the least. It's a React site, using Next.js, which let's be honest, will both look extremely different in less than. To keep the architecture of this site future-proof (such that I can throw whatever functionality onto this and have it stick) I will have to put in some elbow-grease, but the trade off for making it easily customizable and quick to get going was worth it for me. Other than those two frameworks, I'm limiting myself from adding a ton of dependencies to the project, besides what's necessary in order to keep my house in order.

The good news is that for a static website like this, only a small amount of work is needed to have large positive impacts on longevity. In the grand scheme of things, one can even argue that it's not that important because even if I don't update the architecture of the site at all over a long period of time, it will still stay online, and I'll still be able to add content to it. Regardless, it's still something I think about and it's a good principle to work by. In a previous personal website, I had the experience of cloning its repo, running `npm install` and having absolutely nothing work. I don't ever want that to be the case again!

### Frictionless

This is the most important one for me. It has a lot to do with the title image of this text, and I've fallen victim to the phenomenon of spending countless hours making a custom website only to never touch it again. The links break, pages disappear, and obsolete information takes the spotlight for all of eternity to see.

To address this, I google'd around and fortunately came across Tina, a headless CMS that I can pop into my site, log into it from any machine, and make updates to it that are integrated with git. I can also customize it for the type of data I want to display, but that is for another article and another time.&#x20;

Did I publish something and notice a typo? I can fix that in under a minute.

## What is This Site, Anyway?

There's no format. That's the point of having this thing in the first place. I do feel that is is good for both my personal and professional development to have something public facing, and social media exists! The only problem is that I barely post on Twitter, my Facebook has gathered cobwebs years ago, and Instagram is a distant memory. Rather than try to get myself to do something I do not naturally  gravitate towards (using social media) I'd rather try this.

It takes longer, but it's more fun to have a site I built. Why not build something I have full creative control over? A place where I can ramble, keep a record of milestones in my life, and write something I think someone else might find useful.

Sure, it's not perfect. I'm sure I'll be creating more problems of my own by coding the front-end myself, but that's kind of the point. I'll have something to tinker on, improve over time, and genuinely call my own.
