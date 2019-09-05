import React from "react"
import { connect } from "react-redux"
import {ExchangeBody} from "../Exchange"
import { getTranslate } from 'react-localize-redux'
import * as converter from "../../utils/converter"
import * as exchangeActions from "../../actions/exchangeActions"
import {setIsChangingPath, clearSession} from "../../actions/globalActions"
import {HeaderTransaction} from "../TransactionCommon"
import EthereumService from "../../services/ethereum/ethereum"
import constants from "../../services/constants"
import { Market } from "../Market"

@connect((store, props) => {
  const account = store.account.account
  const translate = getTranslate(store.locale)
  const tokens = store.tokens.tokens
  const exchange = store.exchange
  const ethereum = store.connection.ethereum

  return {
    translate, exchange, tokens, account, ethereum,
    params: {...props.match.params},
  }
})

export default class Exchange extends React.Component {
  constructor(props){
    super(props)
    this.state = {
      isAnimation: false,
      intervalGroup : [],
      isFirstTime: true,
    }
  }

  getEthereumInstance = () => {
    var ethereum = this.props.ethereum
    if (!ethereum){
      ethereum = new EthereumService()
    }
    return ethereum
  }

  setAnimation = () => {
    this.setState({isAnimation: true})
  }

  setInterValGroup = (callback, intervalTime) => {
    callback()
    var intevalProcess = setInterval(callback, intervalTime)
    this.state.intervalGroup.push(intevalProcess)
  }

  checkKyberEnable = () => {
    var ethereum = this.getEthereumInstance()
    this.props.dispatch(exchangeActions.checkKyberEnable(ethereum))
  }

  fetchRateExchange = () => {    
    var ethereum = this.getEthereumInstance()
    var {sourceTokenSymbol, sourceToken, destTokenSymbol, destToken} = this.getTokenInit()
    var sourceAmount = this.props.exchange.sourceAmount
    let refetchSourceAmount = false;
    
    if (sourceTokenSymbol === "ETH") {
      if (converter.compareTwoNumber(sourceAmount, constants.ETH.MAX_AMOUNT) === 1) {
        this.props.dispatch(exchangeActions.throwErrorSourceAmount(constants.EXCHANGE_CONFIG.sourceErrors.rate, this.props.translate("error.handle_amount")))
        return;
      }
    } 

    if (this.props.exchange.inputFocus !== "source"){
      var destAmount = this.props.exchange.destAmount
      var tokens = this.props.tokens
      var rateSourceEth = sourceTokenSymbol === "ETH" ? 1: tokens[sourceTokenSymbol].rate / Math.pow(10,18)
      var rateEthDest = destTokenSymbol === "ETH" ? 1: tokens[destTokenSymbol].rateEth / Math.pow(10,18)
      
      if (rateSourceEth != 0 && rateEthDest != 0){
        sourceAmount = destAmount / (rateSourceEth * rateEthDest)
      }else{
        sourceAmount = 0
      }
      refetchSourceAmount = true;
    }    
    
    var isManual = this.state.isFirstTime ? true: false
    this.setState({isFirstTime: false})
    this.props.dispatch(exchangeActions.updateRate(ethereum, sourceTokenSymbol, sourceToken, destTokenSymbol, destToken, sourceAmount, isManual, refetchSourceAmount, constants.EXCHANGE_CONFIG.updateRateType.interval));
  }

  fetchGasExchange = () =>{    
    if (!this.props.account) {
      return
    }
    this.props.dispatch(exchangeActions.estimateGasNormal())
  }

  async fetchMaxGasPrice(){
    var ethereum = this.getEthereumInstance()
    try{
      var gasPrice = await ethereum.call("getMaxGasPrice")
      var maxGasPriceGwei = converter.weiToGwei(gasPrice)
      this.props.dispatch(exchangeActions.setMaxGasPriceComplete(maxGasPriceGwei))
    }catch(err){
      console.log(err)
    }
  }

  verifyExchange = () => {
    if (!this.props.account) {
      return
    }

    var { sourceTokenDecimals, destTokenDecimals } = this.getTokenInit();

    this.props.dispatch(exchangeActions.verifyExchange())
    this.props.dispatch(exchangeActions.caculateAmount(sourceTokenDecimals, destTokenDecimals))
  }

  setInvervalProcess = () => {
    this.setInterValGroup( this.checkKyberEnable, 10000)
    this.setInterValGroup( this.fetchRateExchange, 10000)
    this.setInterValGroup( this.fetchGasExchange, 10000)
    this.setInterValGroup( this.fetchMaxGasPrice.bind(this), 10000)
    this.setInterValGroup( this.verifyExchange, 3000)
  }

  componentWillUnmount = () => {
    for (var i= 0; i<this.state.intervalGroup.length; i++ ){
      clearInterval(this.state.intervalGroup[i])  
    }
    this.setState({intervalGroup: []})    
  }

  getTokenInit = () => {
    var sourceTokenSymbol = this.props.params.source.toUpperCase()
    var sourceToken = this.props.tokens[sourceTokenSymbol].address
    var sourceTokenDecimals = this.props.tokens[sourceTokenSymbol].decimals
    var destTokenSymbol = this.props.params.dest.toUpperCase()
    var destToken = this.props.tokens[destTokenSymbol].address
    var destTokenDecimals = this.props.tokens[destTokenSymbol].decimals

    return {sourceTokenSymbol, sourceToken, destTokenSymbol, destToken, sourceTokenDecimals, destTokenDecimals}
  }

  componentDidMount = () =>{
    this.setInvervalProcess()

    var {sourceTokenSymbol, sourceToken, destTokenSymbol, destToken} = this.getTokenInit()

    if ((sourceTokenSymbol !== this.props.exchange.sourceTokenSymbol) ||
      (destTokenSymbol !== this.props.exchange.destTokenSymbol) ){
      this.props.dispatch(exchangeActions.selectToken(sourceTokenSymbol, sourceToken, destTokenSymbol, destToken, "default"));
    }
  }

  render() {
    return (
      <div>
        <div className={"exchange-container"}>
          {/*<HeaderTransaction page="exchange"/>*/}
          <ExchangeBody/>
        </div>
        <Market/>
      </div>
    )
  }
}
