import random
import os
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = 'super_secret_key_pocket_track'

db_url = os.environ.get('DATABASE_URL', 'sqlite:///pocket_track.db')

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

WORD_LIST = ['apple', 'brave', 'cranberry', 'delta', 'eagle', 'falcon', 'giant', 'hover', 'ignite', 'jungle', 'karma', 'lunar', 'mango', 'nexus', 'orbit', 'pulse', 'quantum', 'radar', 'solar', 'tango', 'ultra', 'vortex', 'wave', 'xenon', 'yield', 'zenith']

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    recovery_phrase = db.Column(db.String(200), nullable=False)
    monthly_salary = db.Column(db.Float, default=0.0)
    gender = db.Column(db.String(20), nullable=False, default='male')

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    item_name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    date = db.Column(db.Date, nullable=False)

class FixedExpense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    item_name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    due_day = db.Column(db.Integer, nullable=False)

class Loan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    loan_name = db.Column(db.String(100), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    emi_amount = db.Column(db.Float, nullable=False)
    due_date = db.Column(db.Integer, nullable=False) 

class Dream(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    target_name = db.Column(db.String(100), nullable=False)
    target_amount = db.Column(db.Float, nullable=False)
    saved_amount = db.Column(db.Float, default=0.0)

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@app.route('/')
def index():
    is_logged_in = False
    if 'user_id' in session:
        if db.session.get(User, session['user_id']):
            is_logged_in = True
        else:
            session.pop('user_id', None)
    return render_template('index.html', logged_in=is_logged_in)

@app.route('/updates')
def updates():
    return render_template('updates.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name = request.form['name']
        username = request.form['username']
        password = request.form['password']
        gender = request.form['gender']
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return render_template('signup.html', error="Username already exists")
        phrase_words = random.sample(WORD_LIST, 8)
        recovery_phrase = " ".join(phrase_words)
        new_user = User(
            name=name,
            username=username,
            password_hash=generate_password_hash(password),
            recovery_phrase=recovery_phrase,
            gender=gender
        )
        db.session.add(new_user)
        db.session.commit()
        session['temp_recovery_user'] = new_user.id
        session['temp_recovery_phrase'] = recovery_phrase
        return redirect(url_for('recovery'))
    return render_template('signup.html')

@app.route('/recovery')
def recovery():
    if 'temp_recovery_phrase' not in session:
        return redirect(url_for('login'))
    return render_template('recovery.html', phrase=session['temp_recovery_phrase'])

@app.route('/acknowledge_recovery', methods=['POST'])
def acknowledge_recovery():
    if 'temp_recovery_user' in session:
        session['user_id'] = session['temp_recovery_user']
        session.pop('temp_recovery_user', None)
        session.pop('temp_recovery_phrase', None)
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if not user:
            return render_template('login.html', error="Invalid username")
        if not check_password_hash(user.password_hash, password):
            return render_template('login.html', error="Invalid credentials")
        session['user_id'] = user.id
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('index'))

@app.route('/reset_password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        username = request.form['username']
        phrase = request.form['phrase']
        new_password = request.form['new_password']
        user = User.query.filter_by(username=username).first()
        if user and user.recovery_phrase == phrase:
            user.password_hash = generate_password_hash(new_password)
            db.session.commit()
            return redirect(url_for('login'))
        return render_template('reset_password.html', error="Invalid username or recovery phrase")
    return render_template('reset_password.html')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    user = db.session.get(User, session['user_id'])
    
    if not user:
        session.pop('user_id', None)
        return redirect(url_for('login'))

    today = datetime.today().day
    
    loans = Loan.query.filter_by(user_id=user.id).all()
    for loan in loans:
        if loan.due_date == today or loan.due_date == today + 1:
            msg = f"Reminder: EMI of ${loan.emi_amount} for {loan.loan_name} is due!"
            existing = Notification.query.filter_by(user_id=user.id, message=msg, is_read=False).first()
            if not existing:
                new_notif = Notification(user_id=user.id, message=msg)
                db.session.add(new_notif)
                
    fixed_bills = FixedExpense.query.filter_by(user_id=user.id).all()
    for bill in fixed_bills:
        if bill.due_day == today or bill.due_day == today + 1:
            msg = f"Reminder: Fixed Bill '{bill.item_name}' for ${bill.amount} is due soon!"
            existing = Notification.query.filter_by(user_id=user.id, message=msg, is_read=False).first()
            if not existing:
                new_notif = Notification(user_id=user.id, message=msg)
                db.session.add(new_notif)
                
    db.session.commit()
    return render_template('dashboard.html', user=user)

@app.route('/api/user', methods=['PUT'])
def update_user():
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    user = db.session.get(User, session['user_id'])
    
    if not user: return jsonify({"error": "Not found"}), 404
    data = request.json
    
    if 'username' in data and data['username'] and data['username'] != user.username:
        existing = User.query.filter_by(username=data['username']).first()
        if existing: return jsonify({"error": "Username already taken"}), 400
        user.username = data['username']
    if 'name' in data and data['name']:
        user.name = data['name']
    if 'password' in data and data['password']:
        user.password_hash = generate_password_hash(data['password'])
    if 'monthly_salary' in data:
        user.monthly_salary = float(data['monthly_salary'])
        
    db.session.commit()
    return jsonify({"success": True, "name": user.name, "username": user.username, "monthly_salary": user.monthly_salary})

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    date_obj = datetime.strptime(data['date'], '%Y-%m-%d').date()
    new_expense = Expense(
        user_id=session['user_id'],
        item_name=data['item_name'],
        amount=float(data['amount']),
        category=data['category'],
        date=date_obj
    )
    db.session.add(new_expense)
    db.session.commit()
    return jsonify({"success": True})

@app.route('/api/expenses/<timeframe>')
def get_expenses(timeframe):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = session['user_id']
    today = datetime.today().date()
    if timeframe == 'daily':
        start_date = today
    elif timeframe == 'weekly':
        start_date = today - timedelta(days=today.weekday())
    elif timeframe == 'monthly':
        start_date = today.replace(day=1)
    elif timeframe == 'yearly':
        start_date = today.replace(month=1, day=1)
    else:
        start_date = today

    expenses = Expense.query.filter(Expense.user_id == user_id, Expense.date >= start_date).all()
    result = []
    total = 0
    for e in expenses:
        result.append({
            "id": e.id,
            "item_name": e.item_name,
            "amount": e.amount,
            "category": e.category,
            "date": e.date.strftime('%Y-%m-%d')
        })
        total += e.amount
    return jsonify({"expenses": result, "total": total})

@app.route('/api/fixed_expenses', methods=['GET', 'POST'])
def handle_fixed_expenses():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = session['user_id']
    if request.method == 'POST':
        data = request.json
        new_fixed = FixedExpense(
            user_id=user_id,
            item_name=data['item_name'],
            amount=float(data['amount']),
            category=data['category'],
            due_day=int(data['due_day'])
        )
        db.session.add(new_fixed)
        db.session.commit()
        return jsonify({"success": True})
    
    fixed_bills = FixedExpense.query.filter_by(user_id=user_id).all()
    return jsonify([{
        "id": f.id, "item_name": f.item_name, "amount": f.amount, 
        "category": f.category, "due_day": f.due_day
    } for f in fixed_bills])

@app.route('/api/chart_data')
def chart_data():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = session['user_id']
    expenses = Expense.query.filter_by(user_id=user_id).all()
    monthly_totals = {f"{i:02d}": 0 for i in range(1, 13)}
    for e in expenses:
        month_str = e.date.strftime('%m')
        monthly_totals[month_str] += e.amount
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    data = list(monthly_totals.values())
    return jsonify({"labels": labels, "data": data})

@app.route('/api/loans', methods=['GET', 'POST'])
def handle_loans():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = session['user_id']
    if request.method == 'POST':
        data = request.json
        new_loan = Loan(
            user_id=user_id,
            loan_name=data['loan_name'],
            total_amount=float(data['total_amount']),
            emi_amount=float(data['emi_amount']),
            due_date=int(data['due_date'])
        )
        db.session.add(new_loan)
        db.session.commit()
        return jsonify({"success": True})
    loans = Loan.query.filter_by(user_id=user_id).all()
    return jsonify([{
        "id": l.id, "loan_name": l.loan_name, "total_amount": l.total_amount, 
        "emi_amount": l.emi_amount, "due_date": l.due_date
    } for l in loans])

@app.route('/api/dreams', methods=['GET', 'POST', 'PUT'])
def handle_dreams():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = session['user_id']
    if request.method == 'POST':
        data = request.json
        new_dream = Dream(
            user_id=user_id,
            target_name=data['target_name'],
            target_amount=float(data['target_amount'])
        )
        db.session.add(new_dream)
        db.session.commit()
        return jsonify({"success": True})
    if request.method == 'PUT':
        data = request.json
        dream = db.session.get(Dream, data['id'])
        if dream and dream.user_id == user_id:
            new_amount = dream.saved_amount + float(data['add_amount'])
            dream.saved_amount = max(0.0, new_amount) 
            db.session.commit()
            return jsonify({"success": True})
    dreams = Dream.query.filter_by(user_id=user_id).all()
    return jsonify([{
        "id": d.id, "target_name": d.target_name, 
        "target_amount": d.target_amount, "saved_amount": d.saved_amount
    } for d in dreams])

@app.route('/api/notifications')
def get_notifications():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    notifs = Notification.query.filter_by(user_id=session['user_id']).order_by(Notification.created_at.desc()).all()
    return jsonify([{
        "id": n.id, "message": n.message, "is_read": n.is_read, "date": n.created_at.strftime('%Y-%m-%d')
    } for n in notifs])

@app.route('/api/expenses/<int:id>', methods=['DELETE'])
def delete_expense(id):
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    item = db.session.get(Expense, id)
    if item and item.user_id == session['user_id']:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/fixed_expenses/<int:id>', methods=['DELETE'])
def delete_fixed_expense(id):
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    item = db.session.get(FixedExpense, id)
    if item and item.user_id == session['user_id']:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/loans/<int:id>', methods=['DELETE'])
def delete_loan(id):
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    item = db.session.get(Loan, id)
    if item and item.user_id == session['user_id']:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/dreams/<int:id>', methods=['DELETE'])
def delete_dream(id):
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    item = db.session.get(Dream, id)
    if item and item.user_id == session['user_id']:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/notifications/<int:id>', methods=['DELETE'])
def delete_notification(id):
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    item = db.session.get(Notification, id)
    if item and item.user_id == session['user_id']:
        db.session.delete(item)
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"error": "Not found"}), 404

@app.route('/api/account', methods=['DELETE'])
def delete_account():
    if 'user_id' not in session: return jsonify({"error": "Unauthorized"}), 401
    u_id = session['user_id']
    Expense.query.filter_by(user_id=u_id).delete()
    FixedExpense.query.filter_by(user_id=u_id).delete()
    Loan.query.filter_by(user_id=u_id).delete()
    Dream.query.filter_by(user_id=u_id).delete()
    Notification.query.filter_by(user_id=u_id).delete()
    User.query.filter_by(id=u_id).delete()
    db.session.commit()
    session.pop('user_id', None)
    return jsonify({"success": True})

# THE SAFETY BLANKET
with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        print(f"Safe Boot: DB not created yet because -> {e}")

if __name__ == '__main__':
    app.run(debug=True)