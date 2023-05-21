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


@app.route("/insights")
def deeplearning():
    return render_template("insights.html")


@app.route("/motivation")
def motivation():
    return render_template("motivation.html")

# in the future I want to add a Deep Learning route/page to discuss research fidnings

