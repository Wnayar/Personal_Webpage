# Personal Portfolio Website

A full-stack personal portfolio website built with Flask, showcasing my projects, technical skills, and professional journey.

**Live Site:** https://williamdn.pythonanywhere.com/

## Overview

This is a responsive, modern personal portfolio website featuring:
- Project showcase with detailed technical descriptions and live demos
- Guides and resources for aspiring developers
- Interactive UI elements with scroll animations and hover effects
- GitHub activity integration and technical skills visualization
- Mobile-responsive design optimized for all devices
- Clean, professional aesthetic with teal and gold accent colors

## Tech Stack

**Backend:**
- Python
- Flask (web framework)
- Jinja2 (templating)
- Flask-Session

**Frontend:**
- HTML5
- CSS3
- JavaScript
- Bootstrap 5
- Typed.js (dynamic text animations)

**Deployment:**
- PythonAnywhere (hosting)
- Git/GitHub (version control)

## Key Features

### Projects Page
Detailed breakdown of my technical projects including:
- PeerPrep (Node.js microservices backend with 15 REST API endpoints)
- Aqua Vitae (React/TypeScript e-commerce site with Shopify integration)
- NUS-GroupMatch (MERN stack study group platform)
- Personal Portfolio (this Flask website)

Each project includes role, tech stack, detailed bullet points, and links to live sites and GitHub repositories.

### Guides Section
Resources and tutorials covering:
- Getting started with Harvard's CS50
- Local development environment setup
- Git and GitHub workflows for beginners

### Interactive Elements
- Scroll-triggered fade-in animations
- Project card tilt effects on hover (desktop)
- GitHub activity widgets (Top Languages, Total Contributions)
- Technical skills badges with logos
- Smooth hover animations throughout
- Sticky frosted glass navbar
- Animated timeline on Philosophy page

## Project Structure

```
Personal_Webpage/
├── app.py                 # Flask application and routing
├── requirements.txt       # Python dependencies
├── static/
│   ├── style.css         # Global styling
│   ├── index.js          # Homepage interactions
│   ├── insights.js       # Guide interactions
│   └── [images]          # Profile picture and social icons
└── templates/
    ├── layout.html       # Base template with navbar and global styles
    ├── index.html        # Homepage with stats and intro
    ├── projects.html     # Projects showcase with GitHub activity
    ├── guides.html       # Developer guides and resources
    └── motivation.html   # Philosophy page with timeline
```

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/Wnayar/Personal_Webpage.git
cd Personal_Webpage
```

2. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python app.py
```

5. Visit `http://127.0.0.1:5000` in your browser

## Design Philosophy

- **Recruiter-Focused:** Clear project descriptions, prominent contact info, and professional presentation
- **Content-First:** Technical depth without overwhelming complexity
- **Responsive:** Optimized mobile experience with adjusted padding and font sizes
- **Interactive:** Subtle animations and hover effects that enhance without distracting
- **Fast:** Minimal dependencies, quick load times, smooth navigation
- **Modern:** Teal and gold color scheme with frosted glass navbar and card-based layouts

## About This Project

Originally created as my CS50 final project in 2023, this website has evolved into a professional portfolio showcasing my growth as a software engineer. The site demonstrates full-stack development skills, clean code practices, and attention to user experience.

## Contact

- **Email:** wnayar98@gmail.com
- **LinkedIn:** [linkedin.com/in/william-nayar](https://sg.linkedin.com/in/william-nayar)
- **GitHub:** [github.com/Wnayar](https://github.com/Wnayar)

---

Built with Flask and deployed on PythonAnywhere.
