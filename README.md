# Personal Portfolio Website

A full-stack personal portfolio website built with Flask, showcasing my projects, technical skills, and professional journey.

**Live Site:** https://williamdn.pythonanywhere.com/

## Overview

This is a responsive, modern personal portfolio website featuring:
- Project showcase with detailed technical descriptions
- Blog posts about my coding journey
- Interactive UI elements and smooth animations
- Mobile-responsive design
- Clean, professional aesthetic

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
- Aqua Vitae (React/TypeScript e-commerce site)
- PeerPrep (Node.js microservices backend)
- NUS-GroupMatch (MERN stack application)

### Blog Section
Articles covering:
- My journey starting with Harvard's CS50
- Local development setup guides
- Git and GitHub workflows

### Interactive Elements
- Animated 3D gyroscope
- Dynamic typing effects
- Smooth hover animations
- Responsive navigation

## Project Structure

```
Personal_Webpage/
├── app.py                 # Flask application and routing
├── requirements.txt       # Python dependencies
├── static/
│   ├── style.css         # Custom styling
│   ├── index.js          # Homepage interactions
│   ├── insights.js       # Blog post interactions
│   └── [images/videos]   # Media assets
└── templates/
    ├── layout.html       # Base template
    ├── index.html        # Homepage
    ├── projects.html     # Projects showcase
    ├── blogs.html        # Blog posts
    └── motivation.html   # Motivational content
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

- **Simple and Clean:** Focus on content over flashy design
- **Professional:** Suitable for recruiters and technical audiences
- **Responsive:** Works seamlessly on desktop, tablet, and mobile
- **Fast:** Minimal dependencies, quick load times
- **Accessible:** Clear navigation and readable typography

## Future Enhancements

- Add more blog posts documenting technical learnings
- Include project screenshots/demos
- Add dark/light mode toggle
- Implement contact form with backend integration

## About This Project

Originally created as my CS50 final project in 2023, this website has evolved into a professional portfolio showcasing my growth as a software engineer. The site demonstrates full-stack development skills, clean code practices, and attention to user experience.

## Contact

- **Email:** wnayar98@gmail.com
- **LinkedIn:** [linkedin.com/in/william-nayar](https://sg.linkedin.com/in/william-nayar)
- **GitHub:** [github.com/Wnayar](https://github.com/Wnayar)

---

Built with Flask and deployed on PythonAnywhere.
