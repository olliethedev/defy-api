import "./../jestConfig";
import { connectDb, removeAllCollections } from "../utils/DatabaseUtils";
import models from "../models";
import {
  HISTORY_EVENT_TYPES,
  WINNING_OPINION_FEE,
} from "../models/ModelConstants";
import { sleep } from "../utils/Common";
import { ethers } from "ethers";
import { finalize } from "./finalizer";
import Account from "../models/Account";

//TEST DATA
const MOCK_WALLET_1 = ethers.Wallet.createRandom();
const MOCK_WALLET_2 = ethers.Wallet.createRandom();
const MOCK_WALLET_3 = ethers.Wallet.createRandom();
const MOCK_WALLET_4 = ethers.Wallet.createRandom();
const MOCK_WALLET_5 = ethers.Wallet.createRandom();
const MOCK_WALLET_6 = ethers.Wallet.createRandom();
const MOCK_WALLET_CREATOR = ethers.Wallet.createRandom();
const MOCK_WALLET_TIE_CREATOR = ethers.Wallet.createRandom();
const MOCK_WALLETS = [
  MOCK_WALLET_1,
  MOCK_WALLET_2,
  MOCK_WALLET_3,
  MOCK_WALLET_4,
];
const MOCK_WALLETS_2 = [MOCK_WALLET_5, MOCK_WALLET_6];
const DURATION = 5000;
const INITIAL_TOTALS = { totalCon: 0, totalPro: 0 };
const INITIAL_BALANCE = 99999;
const DEBATE_COST = 100;
const TOTAL_VOTES_TIE = 50;
const TIE_VOTE = 10;
let DEBATE_CON_WINS = null;
let DEBATE_TIE = null;
describe("Debate Finalizer", () => {
  beforeAll(async () => {
    await connectDb(process.env.DATABASE_URL);
    await removeAllCollections();
    await models.Account.create({
      address: MOCK_WALLET_CREATOR.address,
      balance: INITIAL_BALANCE,
    });
    DEBATE_CON_WINS = await models.Debate.createDebate(
      MOCK_WALLET_CREATOR.address,
      "Debate Title",
      "Debate Description",
      ["testTag"],
      DEBATE_COST,
      DURATION
    );
    let incr = 0;
    for (let i = 0; i < MOCK_WALLETS.length; i++) {
      const account = MOCK_WALLETS[i];
      await models.Account.create({
        address: account.address,
        balance: INITIAL_BALANCE,
      });
      for (let j = 0; j < 100; j++) {
        const newStake = 100 + incr;
        if (i === 0) {
          INITIAL_TOTALS.totalPro += newStake;
        } else {
          INITIAL_TOTALS.totalCon += newStake;
        }
        await models.Opinion.createOpinion(
          account.address,
          DEBATE_CON_WINS._id,
          "www.google.com",
          "link",
          newStake,
          (i + 2) % 2 === 0
        );

        incr++;
      }
    }
  });

  it("Should not finalize debate before end time", async () => {
    // get initial balances total
    const initialCreator = await models.Account.accountForAddress(
      MOCK_WALLET_CREATOR.address
    );
    const creatorStake = initialCreator.lockedBalance;
    const creatorBalance = initialCreator.balance;
    let totalProStake = 0;
    let totalProBalance = 0;
    let totalConStake = 0;
    let totalConBalance = 0;
    for (let i = 0; i < MOCK_WALLETS.length; i++) {
      const account = MOCK_WALLETS[i];
      const accountModel = await models.Account.accountForAddress(
        account.address
      );
      const staked = accountModel.lockedBalance;
      const balance = accountModel.balance;
      if (i === 0) {
        //pro
        totalProStake += staked;
        totalProBalance += balance;
      } else {
        //con
        totalConStake += staked;
        totalConBalance += balance;
      }
    }
    expect(totalProStake).toBe(INITIAL_TOTALS.totalPro);
    expect(totalConStake).toBe(INITIAL_TOTALS.totalCon);
    expect(creatorStake).toBe(DEBATE_COST);
    expect(creatorBalance).toBe(INITIAL_BALANCE - DEBATE_COST);
    // finalize
    await finalize(DURATION);
    // get final balances total
    let finalTotalProStake = 0;
    let finalTotalProBalance = 0;
    let finalTotalConStake = 0;
    let finalTotalConBalance = 0;
    for (let i = 0; i < MOCK_WALLETS.length; i++) {
      const account = MOCK_WALLETS[i];
      const accountModel = await models.Account.accountForAddress(
        account.address
      );
      const staked = accountModel.lockedBalance;
      const balance = accountModel.balance;
      if (i === 0) {
        //pro
        finalTotalProStake += staked;
        finalTotalProBalance += balance;
      } else {
        //con
        finalTotalConStake += staked;
        finalTotalConBalance += balance;
      }
    }
    // winning side and losing side totals should not change
    expect(INITIAL_TOTALS.totalPro).toBe(finalTotalProStake);
    expect(INITIAL_TOTALS.totalCon).toBe(finalTotalConStake);
    expect(totalProBalance).toBe(finalTotalProBalance);
    expect(totalConBalance).toBe(finalTotalConBalance);
    // debate attribute "finished" should be false
    const debate = await models.Debate.findById(DEBATE_CON_WINS._id);
    expect(debate.finished).not.toBe(true);
    //check final balance of debate creator
    const finalCreator = await models.Account.accountForAddress(
      MOCK_WALLET_CREATOR.address
    );
    const finalCreatorStake = finalCreator.lockedBalance;
    const finalCreatorBalance = finalCreator.balance;
    expect(finalCreatorStake).toBe(creatorStake);
    expect(finalCreatorBalance).toBe(creatorBalance);
  });

  it("Should finalize regular debate and update balance", async () => {
    const debateTime = (
      await models.Debate.findById(DEBATE_CON_WINS._id)
    ).updated.getTime();
    await sleep(debateTime + DURATION - Date.now());
    // get initial balances total
    const initialCreator = await models.Account.accountForAddress(
      MOCK_WALLET_CREATOR.address
    );
    const creatorStake = initialCreator.lockedBalance;
    const creatorBalance = initialCreator.balance;
    let totalProStake = 0;
    let totalProBalance = 0;
    let totalConStake = 0;
    let totalConBalance = 0;
    for (let i = 0; i < MOCK_WALLETS.length; i++) {
      const account = MOCK_WALLETS[i];
      const accountModel = await models.Account.accountForAddress(
        account.address
      );
      const staked = accountModel.lockedBalance;
      const balance = accountModel.balance;
      if (i === 0) {
        //pro
        totalProStake += staked;
        totalProBalance += balance;
      } else {
        //con
        totalConStake += staked;
        totalConBalance += balance;
      }
    }
    expect(totalProStake).toBe(INITIAL_TOTALS.totalPro);
    expect(totalConStake).toBe(INITIAL_TOTALS.totalCon);
    expect(creatorStake).toBe(DEBATE_COST);
    expect(creatorBalance).toBe(INITIAL_BALANCE - DEBATE_COST);
    // finalize
    await finalize(DURATION);
    // get final balances total
    let finalTotalProStake = 0;
    let finalTotalProBalance = 0;
    let finalTotalConStake = 0;
    let finalTotalConBalance = 0;
    for (let i = 0; i < MOCK_WALLETS.length; i++) {
      const account = MOCK_WALLETS[i];
      const accountModel = await models.Account.accountForAddress(
        account.address
      );
      const staked = accountModel.lockedBalance;
      const balance = accountModel.balance;
      if (i === 0) {
        //pro
        finalTotalProStake += staked;
        finalTotalProBalance += balance;
      } else {
        //con
        finalTotalConStake += staked;
        finalTotalConBalance += balance;
      }
    }
    const PLATFORM = await Account.accountForAddress(process.env.FEE_EARNER);
    // balances of winner and loser should change by the initial stake
    expect(finalTotalProBalance - totalProBalance).toBe(0);
    const winningsCalc =
      totalConBalance +
      INITIAL_TOTALS.totalCon +
      INITIAL_TOTALS.totalPro -
      PLATFORM.balance;
    expect(finalTotalConBalance).toBe(winningsCalc);
    // stake amounts should be zero
    expect(finalTotalConStake).toBe(0);
    expect(finalTotalProStake).toBe(0);
    // debate attribute "finished" should be true
    const debate = await models.Debate.findById(DEBATE_CON_WINS._id);
    expect(debate.finished).toBe(true);
    //check final balance of debate creator
    const finalCreator = await models.Account.accountForAddress(
      MOCK_WALLET_CREATOR.address
    );
    const finalCreatorStake = finalCreator.lockedBalance;
    const finalCreatorBalance = finalCreator.balance;
    expect(finalCreatorStake).toBe(0);
    expect(finalCreatorBalance).toBe(INITIAL_BALANCE);
  });

  it("Should finalize tie debate and update balance", async () => {
    //creating tie event:
    await models.Account.create({
      address: MOCK_WALLET_TIE_CREATOR.address,
      balance: INITIAL_BALANCE,
    });
    DEBATE_TIE = await models.Debate.createDebate(
      MOCK_WALLET_TIE_CREATOR.address,
      "Debate Title Tie",
      "Debate Description Tie",
      ["testTag"],
      DEBATE_COST,
      DURATION
    );

    for (let i = 0; i < MOCK_WALLETS_2.length; i++) {
      const account = MOCK_WALLETS_2[i];
      await models.Account.create({
        address: account.address,
        balance: INITIAL_BALANCE,
      });
      for (let j = 0; j < TOTAL_VOTES_TIE / 2; j++) {
        await models.Opinion.createOpinion(
          account.address,
          DEBATE_TIE._id,
          null,
          "vote",
          TIE_VOTE,
          i === 0
        );
      }
    }

    await sleep(DURATION + 100);
    // get initial balances total
    const initialCreator = await models.Account.accountForAddress(
      MOCK_WALLET_TIE_CREATOR.address
    );
    const creatorStake = initialCreator.lockedBalance;
    const creatorBalance = initialCreator.balance;
    let totalProStake = 0;
    let totalProBalance = 0;
    let totalConStake = 0;
    let totalConBalance = 0;
    for (let i = 0; i < MOCK_WALLETS_2.length; i++) {
      const account = MOCK_WALLETS_2[i];
      const accountModel = await models.Account.accountForAddress(
        account.address
      );
      const staked = accountModel.lockedBalance;
      const balance = accountModel.balance;
      if (i === 0) {
        //pro
        totalProStake += staked;
        totalProBalance += balance;
      } else {
        //con
        totalConStake += staked;
        totalConBalance += balance;
      }
    }
    expect(totalProStake).toBe((TIE_VOTE * TOTAL_VOTES_TIE) / 2);
    expect(totalConStake).toBe((TIE_VOTE * TOTAL_VOTES_TIE) / 2);
    expect(creatorStake).toBe(DEBATE_COST);
    expect(creatorBalance).toBe(INITIAL_BALANCE - DEBATE_COST);
    // finalize
    await finalize(DURATION);
    // get final balances total
    let finalTotalProStake = 0;
    let finalTotalProBalance = 0;
    let finalTotalConStake = 0;
    let finalTotalConBalance = 0;
    for (let i = 0; i < MOCK_WALLETS_2.length; i++) {
      const account = MOCK_WALLETS_2[i];
      const accountModel = await models.Account.accountForAddress(
        account.address
      );
      const staked = accountModel.lockedBalance;
      const balance = accountModel.balance;
      if (i === 0) {
        //pro
        finalTotalProStake += staked;
        finalTotalProBalance += balance;
      } else {
        //con
        finalTotalConStake += staked;
        finalTotalConBalance += balance;
      }
    }
    // winning side and losing side totals should not change
    expect(finalTotalProStake).toBe(0);
    expect(finalTotalConStake).toBe(0);
    expect(finalTotalProBalance).toBe(INITIAL_BALANCE);
    expect(finalTotalConBalance).toBe(INITIAL_BALANCE);
    // debate attribute "finished" should be false
    const debate = await models.Debate.findById(DEBATE_TIE._id);
    expect(debate.finished).toBe(true);
    //check final balance of debate creator
    const finalCreator = await models.Account.accountForAddress(
      MOCK_WALLET_TIE_CREATOR.address
    );
    const finalCreatorStake = finalCreator.lockedBalance;
    const finalCreatorBalance = finalCreator.balance;
    expect(finalCreatorStake).toBe(0);
    expect(finalCreatorBalance).toBe(INITIAL_BALANCE);
  });
});
