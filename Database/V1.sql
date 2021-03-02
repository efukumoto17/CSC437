drop database if exists efukumot;
create database efukumot;
use efukumot;

create table Person (
   id int auto_increment primary key,
   firstName varchar(30),
   lastName varchar(30) not null,
   email varchar(30) not null,
   password varchar(50),
   whenRegistered datetime not null,
   termsAccepted datetime,
   role int unsigned not null,  # 0 normal, 1 admin
   unique key(email)
);

create table Conversation (
   id int auto_increment primary key,
   ownerId int,
   title varchar(80) not null,
   lastMessage datetime,
   constraint FKMessage_ownerId foreign key (ownerId) references Person(id)
    on delete cascade,
   unique key UK_title(title)
);

create table Message (
   id int auto_increment primary key,
   cnvId int not null,
   prsId int not null,
   whenMade datetime not null,
   numLikes int not null,
   content varchar(5000) not null,
   constraint FKMessage_cnvId foreign key (cnvId) references Conversation(id)
    on delete cascade,
   constraint FKMessage_prsId foreign key (prsId) references Person(id)
    on delete cascade
);

create table Likes (
	id int auto_increment primary key,
    cnvId int not null,
    prsId int not null,
	msgId int not null,
    whenMade datetime not null,
    constraint FKLikes_cnvId  foreign key (cnvId) references Conversation(id)
    on delete cascade,
    constraint FKLikes_prsId foreign key (prsId) references Person(id)
    on delete cascade,
    constraint FKLikes_msgId foreign key (msgId) references Message(id)
    on delete cascade
);

insert into Person (firstName, lastName, email,       password,   whenRegistered, role)
            VALUES ("Joe",     "Admin", "adm@11.com", "password", NOW(), 1);
