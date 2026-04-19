from flask import Flask, redirect, render_template, url_for
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


@app.route("/guides")
def guides():
    return render_template("guides.html")


@app.route("/blogs")
def blogs_redirect():
    return render_template("guides.html")


@app.route("/insights")
def insights_redirect():
    return render_template("guides.html")


@app.route("/philosophy")
def philosophy():
    return render_template("philosophy.html")


@app.route("/motivation")
def motivation_redirect():
    return redirect(url_for("philosophy"), code=301)


# the following below is to configure to host on pythonanywhere
if __name__ == "__main__":
    app.run(debug=True)