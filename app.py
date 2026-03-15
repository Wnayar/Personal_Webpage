from flask import Flask, render_template
from flask_session import Session

# Configure application
app = Flask(__name__)

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/projects")
def projects():
    return render_template("projects.html")


@app.route("/blogs")
def blogs():
    return render_template("blogs.html")


@app.route("/insights")
def insights_redirect():
    return render_template("blogs.html")


@app.route("/motivation")
def motivation():
    return render_template("motivation.html")


# the following below is to configure to host on pythonanywhere
if __name__ == "__main__":
    app.run(debug=True)