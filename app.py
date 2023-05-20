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


@app.route("/deeplearning")
def deeplearning():
    return render_template("deeplearning.html")


@app.route("/blog")
def blog():
    return render_template("blog.html")


@app.route("/motivation")
def motivation():
    return render_template("motivation.html")



