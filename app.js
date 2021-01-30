var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var helmet = require('helmet');
var session = require('express-session');
var passport = require('passport');

// モデルの読み込み
var User = require('./models/user');
var Favorite = require('./models/favorite');
User.sync().then(() => {
  Favorite.belongsTo(User, { foreignKey: 'clickedBy' });
  Favorite.sync();
});

var TwitterStrategy = require('passport-twitter').Strategy;
var consumer_key = "DsNiIek6Q6p8acZOLkbnd3Q00";
var consumer_secret = "AulzX8JgAKpN8FdqLLAffqfmbGohK0KbN3Iluv2CxVgXkXW69V";

// セッションに保存
passport.serializeUser(function (user, done) {
  done(null, user);
});

// セッションから復元 routerのreq.userから利用可能
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

passport.use(new TwitterStrategy({
  consumerKey: consumer_key,
  consumerSecret: consumer_secret,
  callbackURL: 'http://localhost:8000/auth/twitter/callback'
},
  // 認証後の処理
  function (accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      User.upsert({
        userId: profile.id,
        username: profile.username
      }).then(() => {
        done(null, profile);
      })
    });
  }
));

var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
var logoutRouter = require('./routes/logout');
var twitterRouter = require('./routes/twitter');
var favoriteRouter = require('./routes/favorite');

var app = express();
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ユーザ情報をセッションに保存するので初期化（開発中は false で）
app.use(session({ secret: '6e8b7102cc1ac2f0', resave: false, saveUninitialized: false }));
// passport自体の初期化
app.use(passport.initialize());
app.use(passport.session());

app.use('/', indexRouter);
app.use('/login', loginRouter);
app.use('/logout', logoutRouter);
app.use('/tweets', twitterRouter); // 検索結果やお気に入りの複数表示なので「tweets」
app.use('/tweets', favoriteRouter); // 一個ずつ処理していくので「tweet」

app.get('/auth/twitter',
  passport.authenticate('twitter'));

app.get('/auth/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/login' }),
  function (req, res) {
    var loginFrom = req.cookies.loginFrom;
    // オープンリダイレクタ脆弱性対策
    if (loginFrom &&
      !loginFrom.includes('http://') &&
      !loginFrom.includes('https://')) {
      res.clearCookie('loginFrom');
      res.redirect(loginFrom);
    } else {
      res.redirect('/');
    }
  });

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
